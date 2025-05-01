# ml_service/main.py

import json
import pandas as pd
import numpy as np
import pickle
import torch
import torch.nn as nn
import torch.optim as optim
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field # Added Field for potential validation
from typing import List, Literal, Dict, Any, Optional # Added Optional
from torch.utils.data import TensorDataset, DataLoader
import logging, warnings, traceback, sys, copy
from datetime import datetime, timedelta, timezone

# --- Basic Configuration ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
warnings.simplefilter('ignore', category=FutureWarning)
pd.options.mode.chained_assignment = None

# --- Constants & Settings ---
# Input file paths from preprocessing script
ML_READY_DF_PATH      = 'cz_players_ml_ready_data.pkl'
REFERENCE_DF_PATH     = 'cz_players_reference_data.pkl' # For context and display
SCALER_PIPELINE_PATH  = 'cz_scaler_pipeline.pkl'
FEATURE_INFO_PATH     = 'cz_feature_info.json'
# --- IMPORTANT: Ensure this path points to the saved state dictionary of the ENCODER ONLY ---
ENCODER_MODEL_PATH    = 'player_encoder_model.pth' # Assuming this holds encoder.state_dict()

# Scoring Weights (Define globally for use in shortlist function)
WEIGHT_SIMILARITY = 0.3
WEIGHT_PERFORMANCE = 0.3
WEIGHT_RECENT = 0.3
WEIGHT_FRESH = 0.1
ARCHETYPE_PERCENTILE = 0.85 # Also needed for archetype creation

# System Settings
SEED = 42
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
# CURRENT_DATE needed for age calculation in shortlist function
# Use a fixed date consistent with preprocessing for reliable age calculation
CURRENT_DATE = datetime(2025, 4, 26) # Make sure this matches preprocessing script's date

# --- FastAPI & CORS Setup ---
app = FastAPI(title="Player Shortlist API")
app.add_middleware(
    CORSMiddleware,
    # Adjust allow_origins for production
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], # Allow common dev origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global Variables for Loaded Data ---
ml_ready_df: Optional[pd.DataFrame] = None
reference_df: Optional[pd.DataFrame] = None
scaler_pipeline = None
feature_info: Dict[str, Any] = {}
feature_cols: List[str] = []
scaled_numeric_cols: List[str] = []
player_id_col: Optional[str] = None
encoder: Optional[nn.Module] = None
all_embeddings: Optional[np.ndarray] = None
# Keep device defined globally for reference elsewhere if needed
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Global device set to: {device}") # Log global device setting


# Best Hyperparameters (from tuning) - needed for model definition
EMBEDDING_DIM = 32
BEST_HIDDEN1_SIZE = 512
BEST_HIDDEN2_SIZE = 64
BEST_DROPOUT1 = 0.4940863172925382
BEST_DROPOUT2 = 0.17214600618183104


# --- Model Definition (Copied from Training Script) ---
class PlayerEmbedder(nn.Module):
    def __init__(self, input_size, embedding_dim=EMBEDDING_DIM,
                 hidden1_size=BEST_HIDDEN1_SIZE, hidden2_size=BEST_HIDDEN2_SIZE,
                 dropout1=BEST_DROPOUT1, dropout2=BEST_DROPOUT2):
        super(PlayerEmbedder, self).__init__()
        if input_size <= 0: raise ValueError(f"Input size must be positive, got {input_size}")
        embedding_dim = max(1, int(embedding_dim)); hidden1_size = max(1, int(hidden1_size)); hidden2_size = max(1, int(hidden2_size))
        dropout1 = float(dropout1); dropout2 = float(dropout2)
        self.net = nn.Sequential(
            nn.Linear(input_size, hidden1_size), nn.ReLU(), nn.BatchNorm1d(hidden1_size), nn.Dropout(dropout1),
            nn.Linear(hidden1_size, hidden2_size), nn.ReLU(), nn.BatchNorm1d(hidden2_size), nn.Dropout(dropout2),
            nn.Linear(hidden2_size, embedding_dim)
        )
    def forward(self, x): return self.net(x)

# --- Load Data & Model on Startup ---
@app.on_event("startup")
def load_model_and_data():
    global ml_ready_df, reference_df, scaler_pipeline, feature_info, feature_cols
    global scaled_numeric_cols, player_id_col, encoder, all_embeddings, device

    try:
        logger.info("--- Loading Preprocessed Data and Metadata ---")
        ml_ready_df = pd.read_pickle(ML_READY_DF_PATH)
        reference_df = pd.read_pickle(REFERENCE_DF_PATH)
        with open(SCALER_PIPELINE_PATH, 'rb') as f: scaler_pipeline = pickle.load(f)
        with open(FEATURE_INFO_PATH, 'r') as f: feature_info = json.load(f)
        feature_cols = feature_info['feature_columns']
        scaled_numeric_cols = feature_info['scaled_numeric_columns']
        player_id_col = feature_info['player_id_column']
        logger.info("Data and metadata loaded.")

        if ml_ready_df.empty or reference_df.empty or not feature_cols or not player_id_col: raise ValueError("Loaded data incomplete.")
        if player_id_col not in ml_ready_df.columns or player_id_col not in reference_df.columns: raise ValueError(f"Player ID column '{player_id_col}' missing.")
        missing_features = [col for col in feature_cols if col not in ml_ready_df.columns]
        if missing_features: raise ValueError(f"Missing features in ML-Ready DF: {missing_features}")

        if ml_ready_df[player_id_col].nunique() == len(ml_ready_df): ml_ready_df = ml_ready_df.set_index(player_id_col)
        else: raise ValueError("Player ID not unique in ML-Ready DF.")
        if reference_df[player_id_col].nunique() == len(reference_df): reference_df = reference_df.set_index(player_id_col)
        else: raise ValueError("Player ID not unique in Reference DF.")
        logger.info("Data validated and index set.")

        input_size = len(feature_cols)
        encoder = PlayerEmbedder(input_size).to(device)
        logger.info(f"Loading trained encoder model from: {ENCODER_MODEL_PATH}")
        encoder.load_state_dict(torch.load(ENCODER_MODEL_PATH, map_location=device))
        encoder.eval()
        logger.info("Encoder loaded and set to eval mode.")

        logger.info("Generating player embeddings...")
        X = ml_ready_df.loc[:, feature_cols].fillna(0).values.astype(np.float32)
        ds = TensorDataset(torch.from_numpy(X))
        loader = DataLoader(ds, batch_size=512, shuffle=False, num_workers=0)
        embeddings_list = []
        with torch.no_grad():
            for (batch,) in loader: embeddings_list.append(encoder(batch.to(device)).cpu().numpy())
        all_embeddings = np.vstack(embeddings_list)
        if all_embeddings.shape[0] != len(ml_ready_df): raise ValueError("Embeddings shape mismatch.")
        logger.info(f"Embeddings generated with shape: {all_embeddings.shape}")

    except Exception as e:
        logger.error(f"FATAL ERROR during startup: {e}", exc_info=True)
        raise RuntimeError(f"Failed to initialize model and data: {e}") from e

# --- Archetype Creation Function ---
def create_archetype_input_vector(position_group_target, age_group, percentile,
                                  feature_cols, scaled_numeric_cols, scaler_pipeline,
                                  reference_data_df):
    if not feature_cols or reference_data_df is None or reference_data_df.empty: logger.error("Missing data for archetype creation."); return None
    archetype_input = pd.Series(0.0, index=feature_cols); original_target_values = {}; scaled_target_values = {}
    age_min, age_max = age_group; required_context_cols = ['position_group', 'age_orig', 'gender']
    target_gender = 'MEN'; gender_col_name = 'gender'

    if not all(col in reference_data_df.columns for col in required_context_cols):
         logger.error(f"Missing required context columns: {required_context_cols}. Using global context."); context_df = reference_data_df.copy()
         if gender_col_name in context_df.columns: context_df = context_df[context_df[gender_col_name].fillna('Unknown').astype(str) == target_gender].copy(); logger.info("Applied gender filter to global context.")
         else: logger.warning("Gender column missing, cannot apply gender filter to global context.")
    else:
        context_df = reference_data_df[(reference_data_df['position_group'] == position_group_target) & (reference_data_df['age_orig'] >= age_min) & (reference_data_df['age_orig'] <= age_max) & (reference_data_df[gender_col_name].fillna('Unknown').astype(str) == target_gender)].copy()
        if context_df.empty:
            logger.warning(f"No players found for context: PosGroup={position_group_target}, Age={age_group}, Gender={target_gender}. Using global context (filtered by gender).")
            context_df = reference_data_df.copy()
            if gender_col_name in context_df.columns: context_df = context_df[context_df[gender_col_name].fillna('Unknown').astype(str) == target_gender].copy(); logger.info("Applied gender filter to global context fallback.")
            else: logger.warning("Gender column missing, cannot apply gender filter to global context fallback.")
        else: logger.info(f"Found {len(context_df)} players for archetype context: PosGroup={position_group_target}, Age={age_group}, Gender={target_gender}.")
    if context_df.empty: logger.error("Context DataFrame empty even after fallback."); archetype_input[:] = 0.5; return archetype_input.values.astype(np.float32)

    original_col_map = {}
    for scaled_col in scaled_numeric_cols:
        potential_orig = f"{scaled_col}_orig"
        if potential_orig in reference_data_df.columns: original_col_map[scaled_col] = potential_orig
        elif scaled_col in reference_data_df.columns: original_col_map[scaled_col] = scaled_col
        else: logger.debug(f"Cannot find original source for scaled column '{scaled_col}'.")
    percentile_cols_scaled = [col for col in scaled_numeric_cols if '_trend_' in col or 'recent_P' in col or 'recent_save' in col or 'game_freshness' in col or 'season_pointsPerGame' in col or 'season_svp' in col]
    inverse_percentile_cols = [col for col in percentile_cols_scaled if 'GAA' in col]
    numeric_cols_to_process = [col for col in scaled_numeric_cols if col in feature_cols]

    for scaled_col in numeric_cols_to_process:
        target_value_orig = 0.0; original_context_col = original_col_map.get(scaled_col)
        source_df_for_stats = context_df
        if not original_context_col or original_context_col not in context_df.columns or not context_df[original_context_col].notna().any():
             original_context_col = original_col_map.get(scaled_col); source_df_for_stats = reference_data_df
             logger.debug(f"Falling back to global reference for archetype column '{scaled_col}'")
        if original_context_col and original_context_col in source_df_for_stats.columns and source_df_for_stats[original_context_col].notna().any():
            context_series = source_df_for_stats[original_context_col].dropna()
            if not context_series.empty:
                if scaled_col in percentile_cols_scaled:
                    target_percentile = percentile;
                    if scaled_col in inverse_percentile_cols: target_percentile = 1.0 - percentile
                    target_value_orig = context_series.quantile(target_percentile)
                elif scaled_col == 'age': target_value_orig = (age_min + age_max) / 2.0
                else: target_value_orig = context_series.median()
            else: target_value_orig = 0.0
        else: logger.warning(f"Cannot find valid data for archetype column '{scaled_col}' (orig: {original_context_col}). Using 0."); target_value_orig = 0.0
        if pd.isna(target_value_orig): logger.warning(f"Target original value for '{scaled_col}' is NaN. Using 0."); target_value_orig = 0.0
        original_target_values[scaled_col] = target_value_orig

    if scaler_pipeline and numeric_cols_to_process:
        target_df_for_scaling = pd.DataFrame([original_target_values])[numeric_cols_to_process]
        target_df_for_scaling = target_df_for_scaling.replace([np.inf, -np.inf], np.nan).fillna(0.0)
        try:
            pipeline_features = scaler_pipeline.feature_names_in_ if hasattr(scaler_pipeline, 'feature_names_in_') else scaler_pipeline.steps[0][1].feature_names_in_ if hasattr(scaler_pipeline.steps[0][1], 'feature_names_in_') else numeric_cols_to_process
            missing_cols = set(pipeline_features) - set(target_df_for_scaling.columns)
            extra_cols = set(target_df_for_scaling.columns) - set(pipeline_features)
            if missing_cols: logger.warning(f"Archetype vector missing columns: {missing_cols}. Filling with 0."); [target_df_for_scaling.insert(loc=0, column=col, value=0.0) for col in missing_cols]
            if extra_cols: logger.warning(f"Archetype vector has extra columns: {extra_cols}. Dropping."); target_df_for_scaling = target_df_for_scaling.drop(columns=list(extra_cols))
            target_df_for_scaling = target_df_for_scaling[pipeline_features]
            scaled_targets_array = scaler_pipeline.transform(target_df_for_scaling)
            scaled_target_values = dict(zip(pipeline_features, scaled_targets_array[0]))
        except Exception as e: logger.error(f"Error scaling archetype vector for PosGroup={position_group_target}, Age={age_group}: {e}. Using 0.5 default."); scaled_target_values = {col: 0.5 for col in numeric_cols_to_process}
    else: logger.warning("Scaler pipeline not available or no numeric columns. Using 0.5 default."); scaled_target_values = {col: 0.5 for col in numeric_cols_to_process}

    for col, scaled_value in scaled_target_values.items():
        if col in archetype_input.index: archetype_input[col] = scaled_value

    pos_col_name = f'pos_{position_group_target}'
    if pos_col_name in archetype_input.index:
        archetype_input[pos_col_name] = 1.0
        other_pos_cols = [f'pos_{p}' for p in ['F', 'D', 'G', 'Unknown'] if f'pos_{p}' != pos_col_name and f'pos_{p}' in archetype_input.index]
        archetype_input[other_pos_cols] = 0.0
    else:
        logger.warning(f"Position column '{pos_col_name}' not found. Setting pos_Unknown=1.")
        unknown_pos_col = 'pos_Unknown'
        if unknown_pos_col in archetype_input.index:
            archetype_input[unknown_pos_col] = 1.0
            other_pos_cols = [f'pos_{p}' for p in ['F', 'D', 'G'] if f'pos_{p}' in archetype_input.index]
            archetype_input[other_pos_cols] = 0.0

    gender_col_name = 'gender_MEN'
    if gender_col_name in archetype_input.index:
        archetype_input[gender_col_name] = 1.0
        other_gender_cols = [col for col in archetype_input.index if col.startswith('gender_') and col != gender_col_name]
        archetype_input[other_gender_cols] = 0.0

    if archetype_input.isnull().any(): logger.warning("NaNs found in final archetype vector. Filling with 0."); archetype_input = archetype_input.fillna(0.0)
    return archetype_input.values.astype(np.float32)


# --- Shortlist Generation Function ---
def generate_birth_year_shortlist(birth_year: int,
                                  ml_ready_player_df: pd.DataFrame,
                                  all_player_embeddings: np.ndarray,
                                  reference_df: pd.DataFrame,
                                  scaler_pipeline,
                                  feature_cols,
                                  scaled_numeric_cols,
                                  player_id_col,
                                  top_n=50,
                                  archetype_percentile=ARCHETYPE_PERCENTILE,
                                  w_similarity=WEIGHT_SIMILARITY,
                                  w_perf=WEIGHT_PERFORMANCE,
                                  w_recent=WEIGHT_RECENT,
                                  w_fresh=WEIGHT_FRESH) -> dict:
    logger.info(f"\n--- Generating Shortlist: Birth Year {birth_year} (Filtering by Age & Gender='MEN') (Top {top_n}) ---")
    if all_player_embeddings is None or reference_df is None or ml_ready_player_df is None: logger.error("Embeddings or DataFrames not available."); return {'G': pd.DataFrame(), 'D': pd.DataFrame(), 'F': pd.DataFrame()}
    if len(ml_ready_player_df) != all_player_embeddings.shape[0]: logger.error(f"Mismatch between ml_ready_df length ({len(ml_ready_player_df)}) and embeddings length ({all_player_embeddings.shape[0]})."); return {'G': pd.DataFrame(), 'D': pd.DataFrame(), 'F': pd.DataFrame()}

    age_col_name = 'age_orig'; gender_col_name = 'gender'; target_gender = 'MEN'
    required_cols = [age_col_name, gender_col_name, 'position_group']
    if not all(col in reference_df.columns for col in required_cols):
        missing = [col for col in required_cols if col not in reference_df.columns]; logger.error(f"Required columns missing from Reference DF: {missing}."); return {'G': pd.DataFrame(), 'D': pd.DataFrame(), 'F': pd.DataFrame()}
    current_year = CURRENT_DATE.year; target_age = current_year - birth_year # Use fixed CURRENT_DATE
    logger.info(f"Filtering for players with {age_col_name} == {target_age} AND {gender_col_name} == '{target_gender}'")
    ref_local = reference_df.copy()
    ref_local[age_col_name] = pd.to_numeric(ref_local[age_col_name], errors='coerce')
    valid_age_mask = ref_local[age_col_name].notna()
    ref_local[gender_col_name] = ref_local[gender_col_name].fillna('Unknown').astype(str)
    year_filtered_ref_df = ref_local[valid_age_mask & (ref_local[age_col_name] == target_age) & (ref_local[gender_col_name] == target_gender)]
    if year_filtered_ref_df.empty: logger.warning(f"No players found for age {target_age}, gender '{target_gender}'."); return {'G': pd.DataFrame(), 'D': pd.DataFrame(), 'F': pd.DataFrame()}
    logger.info(f"Found {len(year_filtered_ref_df)} players for age {target_age}, gender '{target_gender}'.")

    target_player_ids = year_filtered_ref_df.index.tolist()
    ml_df_index_to_embedding_idx = {idx: i for i, idx in enumerate(ml_ready_player_df.index)}
    year_embedding_indices = [ml_df_index_to_embedding_idx.get(pid) for pid in target_player_ids]
    valid_map = [(pid, idx) for pid, idx in zip(target_player_ids, year_embedding_indices) if idx is not None]
    if len(valid_map) != len(target_player_ids): logger.warning(f"Mismatch finding embeddings ({len(target_player_ids)} vs {len(valid_map)} found).")
    if not valid_map: logger.error("Could not map any filtered players to embeddings."); return {'G': pd.DataFrame(), 'D': pd.DataFrame(), 'F': pd.DataFrame()}
    filtered_pids = [pid for pid, idx in valid_map]; filtered_embedding_indices = [idx for pid, idx in valid_map]
    year_embeddings = all_player_embeddings[filtered_embedding_indices]
    year_filtered_ref_df = year_filtered_ref_df.loc[filtered_pids]

    age_min_context = target_age - 1; age_max_context = target_age + 1; age_group_context = (age_min_context, age_max_context); archetype_embeddings = {}
    with torch.no_grad():
        for pos_group in ['G', 'D', 'F']:
            logger.info(f"Generating archetype embedding for PosGroup={pos_group}, Context Age={age_group_context}, Pct={archetype_percentile}")
            archetype_input_vec = create_archetype_input_vector( pos_group, age_group_context, archetype_percentile, feature_cols, scaled_numeric_cols, scaler_pipeline, reference_df )
            if archetype_input_vec is None: logger.error(f"Failed to create archetype vector for {pos_group}."); continue
            archetype_input_tensor = torch.tensor(archetype_input_vec, dtype=torch.float32).unsqueeze(0).to(device);
            if archetype_input_tensor.shape[0] <= 1 and hasattr(encoder, 'modules') and any(isinstance(m, nn.BatchNorm1d) for m in encoder.modules()): logger.warning(f"Generating archetype embedding for {pos_group} with batch size 1 and BatchNorm active.")
            archetype_embeddings[pos_group] = encoder(archetype_input_tensor).detach().cpu().numpy()

    final_scores = []; similarity_scores = []; perf_scores = []; recent_perf_scores = []; fresh_scores = []
    player_ids_for_scores = []
    trend_weight = 0.7; recent_weight = 0.3

    for i, player_id in enumerate(year_filtered_ref_df.index):
        player_ids_for_scores.append(player_id)
        try:
            player_row_ref = year_filtered_ref_df.loc[player_id]
            player_row_ml = ml_ready_df.loc[player_id] # Get scaled features
            player_pos_group = player_row_ref.get('position_group', 'Unknown')
            if pd.isna(player_pos_group): player_pos_group = 'Unknown'
        except KeyError: logger.warning(f"Could not find data for player {player_id}. Skipping."); continue

        player_embedding = year_embeddings[i:i+1]; similarity_score = 0.0
        if player_pos_group in archetype_embeddings:
            archetype_embed = archetype_embeddings[player_pos_group]; norm_player = np.linalg.norm(player_embedding); norm_archetype = np.linalg.norm(archetype_embed)
            if norm_player > 1e-9 and norm_archetype > 1e-9: cos_sim = np.dot(player_embedding, archetype_embed.T) / (norm_player * norm_archetype); similarity_score = (cos_sim.item() + 1.0) / 2.0
        else: logger.debug(f"No archetype embedding for pos group '{player_pos_group}' of player {player_id}.")

        game_fresh_score = player_row_ml.get('game_freshness', 0.0)
        perf_score = 0.0; recent_perf_score = 0.0; player_trends = []
        if player_pos_group == 'G':
            gaa_trends = [player_row_ml.get(col, 0.0) for col in feature_cols if 'adj_GAA_trend' in col]
            svp_trends = [player_row_ml.get(col, 0.0) for col in feature_cols if 'adj_SVP_trend' in col]
            if gaa_trends: player_trends.append(np.mean([1.0 - t for t in gaa_trends]))
            if svp_trends: player_trends.append(np.mean(svp_trends))
            recent_perf_rate = player_row_ml.get('recent_adj_save_pct', 0.0)
            if recent_perf_rate == 0.0: recent_perf_rate = player_row_ml.get('adj_season_svp', 0.0)
        elif player_pos_group in ['D', 'F']:
            p_trends = [player_row_ml.get(col, 0.0) for col in feature_cols if 'adj_P_per_GP_trend' in col]
            g_trends = [player_row_ml.get(col, 0.0) for col in feature_cols if 'adj_G_per_GP_trend' in col]
            if p_trends: player_trends.append(np.mean(p_trends))
            if g_trends: player_trends.append(np.mean(g_trends))
            recent_perf_rate = player_row_ml.get('recent_adj_P_per_GP', 0.0)
            if recent_perf_rate == 0.0: recent_perf_rate = player_row_ml.get('adj_season_pointsPerGame', 0.0)
        avg_trend_score = np.mean(player_trends) if player_trends else 0.0
        recent_perf_rate = float(recent_perf_rate) if pd.notna(recent_perf_rate) else 0.0
        perf_score = (trend_weight * avg_trend_score) + (recent_weight * recent_perf_rate)
        recent_perf_score = recent_perf_rate
        similarity_score = np.clip(similarity_score, 0.0, 1.0); perf_score = np.clip(perf_score, 0.0, 1.0); recent_perf_score = np.clip(recent_perf_score, 0.0, 1.0); game_fresh_score = np.clip(game_fresh_score, 0.0, 1.0)
        final_score = (w_similarity * similarity_score) + (w_perf * perf_score) + (w_recent * recent_perf_score) + (w_fresh * game_fresh_score);
        similarity_scores.append(similarity_score); perf_scores.append(perf_score); recent_perf_scores.append(recent_perf_score); fresh_scores.append(game_fresh_score); final_scores.append(final_score)

    scores_df = pd.DataFrame({
        player_id_col: player_ids_for_scores, 'final_score': final_scores, 'archetype_similarity': similarity_scores,
        'perf_score_scaled': perf_scores, 'recent_perf_score_scaled': recent_perf_scores, 'game_freshness_scaled': fresh_scores
    }).set_index(player_id_col)
    year_filtered_ref_df = year_filtered_ref_df.join(scores_df, how='left')
    score_cols_list = ['final_score', 'archetype_similarity', 'perf_score_scaled', 'recent_perf_score_scaled', 'game_freshness_scaled']
    year_filtered_ref_df[score_cols_list] = year_filtered_ref_df[score_cols_list].fillna(0.0)

    shortlists = {}
    for pos_group in ['G', 'D', 'F']:
        pos_mask = year_filtered_ref_df['position_group'] == pos_group
        pos_df = year_filtered_ref_df[pos_mask].copy()
        num_found_before_head = len(pos_df)
        logger.info(f"Found {num_found_before_head} players for pos group {pos_group}, birth year {birth_year} (age {target_age}, gender '{target_gender}') before taking top {top_n}.")
        if not pos_df.empty and 'final_score' in pos_df.columns:
            ranked_pos_df = pos_df.sort_values('final_score', ascending=False).head(top_n);
            shortlists[pos_group] = ranked_pos_df;
        else: logger.warning(f"No players/scores found for pos group {pos_group}, birth year {birth_year} (age {target_age}, gender '{target_gender}')."); shortlists[pos_group] = pd.DataFrame()
    return shortlists


# --- FastAPI Request/Response Models ---
class ShortlistRequest(BaseModel):
    birth_year: int
    position: Literal['G','D','F']
    top_n: int = Field(default=10, ge=1, le=100) # Add validation

class PlayerOut(BaseModel):
    # Core Identifiers
    player_id: str
    name: Optional[str] = None
    age_orig: Optional[int] = None
    position_orig: Optional[str] = None
    nationality_orig: Optional[str] = None
    position_group: Optional[str] = None
    gender: Optional[str] = None

    final_score: Optional[float] = None
    archetype_similarity: Optional[float] = None
    perf_score_scaled: Optional[float] = None
    recent_perf_score_scaled: Optional[float] = None
    game_freshness_scaled: Optional[float] = None

    season_gamesPlayed_orig: Optional[int] = None
    season_goals_orig: Optional[int] = None
    season_assists_orig: Optional[int] = None
    season_points_orig: Optional[int] = None
    season_pointsPerGame_orig: Optional[float] = None
    season_gaa_orig: Optional[float] = None
    season_svp_orig: Optional[float] = None
    season_shutouts_orig: Optional[int] = None

    recent_GP: Optional[int] = None
    recent_G: Optional[int] = None # Raw recent goals
    recent_A: Optional[int] = None # Raw recent assists
    recent_TP: Optional[int] = None # Raw recent points
    recent_PIM: Optional[int] = None # Raw recent PIM
    recent_plus_minus: Optional[int] = None # Raw recent +/-
    recent_saves: Optional[int] = None # Raw recent saves
    recent_shots_against: Optional[int] = None # Raw recent shots against
    recent_adj_P_per_GP: Optional[float] = None # Adjusted recent P/GP (from _orig)
    recent_adj_save_pct: Optional[float] = None # Adjusted recent SV% (from _orig)

    # Freshness Original Value
    days_since_last_game: Optional[int] = None


# --- Endpoint ---
@app.post("/shortlist/", response_model=List[PlayerOut])
def get_shortlist(req: ShortlistRequest):
    logger.info(f"Received shortlist request: year={req.birth_year}, position={req.position}, top_n={req.top_n}")
    try:
        if reference_df is None or ml_ready_df is None or all_embeddings is None or encoder is None:
             raise HTTPException(status_code=503, detail="Service not ready, data or model not loaded.")

        shortlists_for_year = generate_birth_year_shortlist(
            birth_year=req.birth_year, ml_ready_player_df=ml_ready_df, all_player_embeddings=all_embeddings,
            reference_df=reference_df, scaler_pipeline=scaler_pipeline, feature_cols=feature_cols,
            scaled_numeric_cols=scaled_numeric_cols, player_id_col=player_id_col, top_n=req.top_n
        )
        df = shortlists_for_year.get(req.position)
        if df is None or df.empty: return []

        if df.index.name == player_id_col: recs = df.reset_index().to_dict(orient='records')
        else: recs = df.to_dict(orient='records')

        output_players = []
        for r in recs:
            try:
                player_data = {
                    'player_id': str(r.get(player_id_col, 'N/A')),
                    'name': r.get('name'),
                    'age_orig': int(r['age_orig']) if pd.notna(r.get('age_orig')) else None,
                    'final_score': float(r['final_score']) if pd.notna(r.get('final_score')) else None,
                    'archetype_similarity': float(r['archetype_similarity']) if pd.notna(r.get('archetype_similarity')) else None,
                    'position_orig': r.get('position_orig'),
                    'nationality_orig': r.get('nationality_orig'),
                    'position_group': r.get('position_group'),
                    'gender': r.get('gender'),
                    'season_gamesPlayed_orig': int(r['season_gamesPlayed_orig']) if pd.notna(r.get('season_gamesPlayed_orig')) else None,
                    'season_goals_orig': int(r['season_goals_orig']) if pd.notna(r.get('season_goals_orig')) else None,
                    'season_assists_orig': int(r['season_assists_orig']) if pd.notna(r.get('season_assists_orig')) else None,
                    'season_points_orig': int(r['season_points_orig']) if pd.notna(r.get('season_points_orig')) else None,
                    'season_pointsPerGame_orig': float(r['season_pointsPerGame_orig']) if pd.notna(r.get('season_pointsPerGame_orig')) else None,
                    'season_gaa_orig': float(r['season_gaa_orig']) if pd.notna(r.get('season_gaa_orig')) else None,
                    'season_svp_orig': float(r['season_svp_orig']) if pd.notna(r.get('season_svp_orig')) else None,
                    'season_shutouts_orig': int(r['season_shutouts']) if pd.notna(r.get('season_shutouts')) else None,
                    'recent_GP': int(r['recent_GP']) if pd.notna(r.get('recent_GP')) else None,
                    'recent_adj_P_per_GP': float(r.get('recent_adj_P_per_GP_orig')) if pd.notna(r.get('recent_adj_P_per_GP_orig')) else None,
                    'recent_adj_save_pct': float(r.get('recent_adj_save_pct_orig')) if pd.notna(r.get('recent_adj_save_pct_orig')) else None,
                    'game_freshness_scaled': float(r['game_freshness_scaled']) if pd.notna(r.get('game_freshness_scaled')) else None,
                    'perf_score_scaled': float(r['perf_score_scaled']) if pd.notna(r.get('perf_score_scaled')) else None,
                    'recent_perf_score_scaled': float(r['recent_perf_score_scaled']) if pd.notna(r.get('recent_perf_score_scaled')) else None,
                    'days_since_last_game': int(r['days_since_last_game']) if pd.notna(r.get('days_since_last_game')) else None,
                    'recent_G': int(r['recent_G']) if pd.notna(r.get('recent_G')) else None,
                    'recent_A': int(r['recent_A']) if pd.notna(r.get('recent_A')) else None,
                    'recent_TP': int(r['recent_TP']) if pd.notna(r.get('recent_TP')) else None,
                    'recent_PIM': int(r['recent_PIM']) if pd.notna(r.get('recent_PIM')) else None,
                    'recent_plus_minus': int(r['recent_plus_minus']) if pd.notna(r.get('recent_plus_minus')) else None,
                    'recent_saves': int(r['recent_saves']) if pd.notna(r.get('recent_saves')) else None,
                    'recent_shots_against': int(r['recent_shots_against']) if pd.notna(r.get('recent_shots_against')) else None,
                }
                output_players.append(PlayerOut(**player_data))
            except Exception as parse_err:
                 logger.warning(f"Skipping record for player {r.get(player_id_col, 'UNKNOWN')} due to Pydantic parsing/validation error: {parse_err}. Record keys: {list(r.keys())}")
                 continue

        return output_players

    except HTTPException: raise
    except Exception as e:
        logger.error(f"Error processing /shortlist/ request: {req}", exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error processing shortlist request.")

# --- Optional: Add a root endpoint for health check ---
@app.get("/")
def read_root():
    if encoder is not None and all_embeddings is not None:
        return {"status": "ML Service Ready", "device": str(device), "embeddings_shape": all_embeddings.shape}
    else:
        return {"status": "ML Service Initializing", "device": str(device)}

# To run (save as main.py): uvicorn main:app --reload --port 8001



