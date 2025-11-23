export interface Message {
  role: "user" | "agent";
  message: string;
  time_in_call_secs: number;
  tool_calls?: any[];
  tool_results?: any[];
  conversation_turn_metrics?: {
    metrics?: {
      convai_llm_service_ttfb?: { elapsed_time: number };
      convai_tts_service_ttfb?: { elapsed_time: number };
      convai_llm_service_tt_last_sentence?: { elapsed_time: number };
    };
  };
}

export interface Conversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript: Message[];
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
    termination_reason?: string;
  };
  conversation_initiation_client_data?: {
    dynamic_variables?: {
      user_firstname?: string;
      context_title?: string;
      context_type?: string;
      system_prompt?: string;
      greeting?: string;
    };
  };
  readable_date?: string; 
}

export type ViewMode = 'overview' | 'strategy' | 'explorer' | 'transcript';

export interface FilterState {
  agentId?: string;
  contextType?: string;
  contextTitle?: string;
  date?: string; // Legacy single date
  startDate?: string; // NEW: Range support
  endDate?: string;   // NEW: Range support
  interactionMode?: "Standard" | "Specialized";
  filterType?: "All" | "Tech Failure" | "Short (<15s)" | "Long (>60s)" | "Tool Used" | "Tool Failure";
}

export type PinnedItemType = 'conversation' | 'stat-row' | 'stat-slice';

export interface PinnedItem {
  id: string;
  type: PinnedItemType;
  label: string;
  data: any;
  context?: {
    metric: string;
    value: string | number;
    filter: FilterState;
  };
  timestamp: number;
}