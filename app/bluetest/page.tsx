// app/advisor/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { LogoHeader } from '@/components/LogoHeader';
import IntroductoryChat, { AppTranscriptMessage } from '@/components/Elevenlabs2'; // Corrected import name
import MainConversation from '@/components/MainConversation'; 
import { ROLE_CONTENTS_INTRO, ROLE_CONTENTS_MAIN } from '../lib/prompts'; 
import { User, Users, Eye, CheckCircle, ArrowRight, RefreshCw, MessageCircle, List } from 'lucide-react';
import { Spinner, Button as NextUIButton, Tooltip } from '@nextui-org/react'; 
import { TranscriptModal } from '@/components/TranscriptModal';

interface RoleCardProps {
  title: string;
  icon: React.ReactNode;
  onSelect: () => void;
  isSelected: boolean;
  isIntroChatCompleted: boolean; 
  mainChatCount: number;
  onViewIntroTranscript: () => void;
  onViewMainTranscripts?: () => void;
  currentStage: 'introductory' | 'mainSession';
  allIntroChatsDoneForMainSession: boolean;
}

const RoleCard: React.FC<RoleCardProps> = ({ 
  title, icon, onSelect, isSelected, isIntroChatCompleted, mainChatCount,
  onViewIntroTranscript, onViewMainTranscripts, currentStage, allIntroChatsDoneForMainSession 
}) => {
  const graetBlue = '#0e0c66';
  const iconBaseSize = 48; 
  const iconResponsiveClasses = "md:w-16 md:h-16";
  const canStartMainChatForThisRole = currentStage === 'mainSession' && allIntroChatsDoneForMainSession;

  return (
    <div className={`
      p-6 md:p-8 bg-white rounded-xl shadow-lg border-2
      flex flex-col items-center justify-center text-center
      transition-all duration-200 ease-in-out 
      relative group 
      ${isIntroChatCompleted && currentStage === 'introductory' ? 'border-green-400' : 
        (isSelected && (!isIntroChatCompleted || currentStage === 'mainSession') ? `border-[${graetBlue}]` : 'border-gray-200')}
    `}>
      <button
        onClick={onSelect}
        disabled={
          (currentStage === 'introductory' && isIntroChatCompleted && !isSelected) || 
          (currentStage === 'mainSession' && !allIntroChatsDoneForMainSession && !isSelected)
        }
        className={`
          w-full flex flex-col items-center justify-center
          focus:outline-none
          ${(currentStage === 'introductory' && isIntroChatCompleted) ? 'opacity-70' : 'transform hover:scale-105'}
          ${(currentStage === 'introductory' && isIntroChatCompleted && !isSelected) ? 'cursor-default' : ''}
          ${(currentStage === 'mainSession' && !allIntroChatsDoneForMainSession) ? 'opacity-70 cursor-not-allowed' : ''}
        `}
      >
        <div className={`mb-4 
          ${isSelected && (!isIntroChatCompleted || canStartMainChatForThisRole) ? `text-[${graetBlue}]` : 
            (isIntroChatCompleted && currentStage === 'introductory' ? 'text-green-500' : 'text-gray-500')}`}>
          {isIntroChatCompleted && currentStage === 'introductory' 
            ? <CheckCircle size={iconBaseSize} className={`${iconResponsiveClasses} text-green-500`} strokeWidth={1.5} /> 
            : icon 
          }
        </div>
        <h3 className={`text-xl font-semibold 
          ${isSelected && (!isIntroChatCompleted || canStartMainChatForThisRole) ? `text-[${graetBlue}]` : 
            (isIntroChatCompleted && currentStage === 'introductory' ? 'text-green-700' : 'text-gray-800')}`}>
          {title}
        </h3>
        {currentStage === 'introductory' && isIntroChatCompleted && 
          <span className="text-xs block mt-1 text-green-600 font-medium">Intro Chat Completed</span>}
        {canStartMainChatForThisRole && 
          <span className="text-xs block mt-1 text-blue-600 font-medium">
            Ready for Main Chat {mainChatCount > 0 ? `(${mainChatCount} done)` : ''}
          </span>}
      </button>
      
      <div className="flex flex-col items-center mt-3 space-y-2">
        {isIntroChatCompleted && (
          <NextUIButton 
            size="sm" variant="bordered" color="default" startContent={<Eye size={14} />}
            onPress={onViewIntroTranscript}
            className="text-xs w-full max-w-[180px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            View Intro Transcript
          </NextUIButton>
        )}
        {currentStage === 'mainSession' && allIntroChatsDoneForMainSession && mainChatCount > 0 && onViewMainTranscripts && (
           <NextUIButton 
            size="sm" variant="bordered" color="secondary" startContent={<List size={14} />}
            onPress={onViewMainTranscripts}
            className="text-xs w-full max-w-[180px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            View Main Chats ({mainChatCount})
          </NextUIButton>
        )}
      </div>

       {isSelected && ((currentStage === 'introductory' && !isIntroChatCompleted) || (currentStage === 'mainSession' && allIntroChatsDoneForMainSession)) && (
        <div className={`absolute inset-0 rounded-xl ring-4 ring-opacity-50 ring-[${graetBlue}] pointer-events-none`}></div>
      )}
    </div>
  );
};


export default function SelectRolePage() {
  const [selectedRoleForCard, setSelectedRoleForCard] = useState<string | null>(null);
  const [activeChatRole, setActiveChatRole] = useState<string | null>(null);
  const [currentChatPromptAndGreeting, setCurrentChatPromptAndGreeting] = useState<{prompt: string; greeting: string} | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  
  const [introTranscripts, setIntroTranscripts] = useState<Record<string, AppTranscriptMessage[]>>({});
  const [mainSessionTranscripts, setMainSessionTranscripts] = useState<Record<string, AppTranscriptMessage[][]>>({});
  const [currentStage, setCurrentStage] = useState<'introductory' | 'mainSession'>('introductory');

  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);
  const [viewingTranscriptForRole, setViewingTranscriptForRole] = useState<string | null>(null);
  const [viewingTranscriptType, setViewingTranscriptType] = useState<'intro' | 'main' | null>(null);
  const [currentMainTranscriptToView, setCurrentMainTranscriptToView] = useState<AppTranscriptMessage[] | null>(null);

  const graetBlue = '#0e0c66';

  // Hardcoded names for now, ideally these come from user data or context
  const PLAYER_NAME_CONST = ROLE_CONTENTS_INTRO['player']?.greeting.split(',')[0].replace('Hey ', '') || 'Player'; // Extract from greeting
  const PARENT_1_NAME_CONST = ROLE_CONTENTS_INTRO['parent1']?.greeting.split(',')[0].replace('Hi ', '') || 'Parent 1';
  const PARENT_2_NAME_CONST = ROLE_CONTENTS_INTRO['parent2']?.greeting.split(',')[0].replace('Hi ', '') || 'Parent 2';


  useEffect(() => {
    console.log("SelectRolePage State: stage:", currentStage, "activeChat:", activeChatRole, "selectedCard:", selectedRoleForCard, 
                "introTranscripts:", Object.keys(introTranscripts).length,
                "mainSessionTranscripts:", Object.entries(mainSessionTranscripts).map(([key, value]) => `${key}: ${value.length} sessions`).join(', '));
  }, [currentStage, activeChatRole, selectedRoleForCard, introTranscripts, mainSessionTranscripts]);

  const roles = [
    { id: 'player', title: 'Player', icon: <User size={48} className="md:w-16 md:h-16" strokeWidth={1.5} /> },
    { id: 'parent1', title: 'Parent 1', icon: <Users size={48} className="md:w-16 md:h-16" strokeWidth={1.5} /> },
    { id: 'parent2', title: 'Parent 2', icon: <Users size={48} className="md:w-16 md:h-16" strokeWidth={1.5} /> },
  ];

  const canProceedToMainSession = useMemo(() => {
    const playerDone = introTranscripts['player'] && introTranscripts['player'].length > 0;
    const parent1Done = introTranscripts['parent1'] && introTranscripts['parent1'].length > 0;
    const parent2Done = introTranscripts['parent2'] && introTranscripts['parent2'].length > 0;
    return playerDone && (parent1Done || parent2Done);
  }, [introTranscripts]);

  const handleRoleCardSelect = (roleId: string) => {
    if (!activeChatRole) setSelectedRoleForCard(roleId);
  };

  // --- NEW TRANSCRIPT FORMATTING FUNCTIONS ---

  const formatSingleTranscriptSegment = (transcript: AppTranscriptMessage[]): string => {
    let formatted = "";
    transcript.forEach(msg => {
      if (msg.speaker !== 'system_event') {
        formatted += `${msg.speaker === 'ai' ? 'Blue' : msg.speaker.toUpperCase()}: ${msg.text}\n`;
      }
    });
    return formatted;
  };

  const formatPlayerIntroTranscriptForPrompt = (transcript: AppTranscriptMessage[]): string => {
    const playerName = PLAYER_NAME_CONST;
    let content = `\n\n--- Appended: Player's Introductory Meeting Transcript ---\n`;
    content += `The following is the transcript from the initial introductory meeting Blue had directly with the player, ${playerName}. This conversation focused on understanding the player's personal hockey spark, current game focus, academic balance, initial understanding of recruitment, and their support system/challenges.\n\n`;
    content += `Instructions for using this Player Introductory Transcript:\n`;
    content += `1.  Core Understanding: Use this as the primary source for understanding the player's self-reported goals, motivations, perceived strengths/weaknesses, and challenges.\n`;
    content += `2.  Personalization: Refer to specific points mentioned by the player to personalize your advice and questions in the current main session. Show you remember what they shared.\n`;
    content += `3.  Identify Discrepancies/Growth: If the current conversation reveals changes from what was stated in this intro (e.g., new goals, overcome challenges), acknowledge this growth or explore the shift.\n`;
    content += `4.  Context for Parent Insights: When reviewing parent introductory transcripts, use this player transcript as a baseline to understand the player's own perspective on topics parents might also discuss.\n\n`;
    content += formatSingleTranscriptSegment(transcript);
    content += `--- End of Player's Introductory Meeting Transcript ---\n`;
    return content;
  };

  const formatParentIntroTranscriptForPrompt = (transcript: AppTranscriptMessage[], parentId: 'parent1' | 'parent2'): string => {
    const playerName = PLAYER_NAME_CONST;
    const parentName = parentId === 'parent1' ? PARENT_1_NAME_CONST : PARENT_2_NAME_CONST;
    const parentTitle = parentId === 'parent1' ? "Parent 1's" : "Parent 2's";

    let content = `\n\n--- Appended: ${parentTitle} (${parentName}) Introductory Meeting Transcript ---\n`;
    content += `The following is the transcript from the initial introductory meeting Blue had with ${parentName}, one of the player's parents. This conversation focused on ${parentName}'s perspective on the player's journey, family support dynamics, financial considerations for hockey, academic views, and their hopes/concerns as a parent.\n\n`;
    content += `Instructions for using this ${parentTitle} Introductory Transcript:\n`;
    content += `1.  Family Context: Use this to understand the family environment, support structures, and practical considerations (like finances or time) that influence the player's hockey journey from ${parentName}'s viewpoint.\n`;
    content += `2.  Parental Goals & Concerns: Identify ${parentName}'s specific hopes for the player and any concerns they raised. Tailor advice to address these if relevant, especially when speaking to ${parentName}.\n`;
    content += `3.  Cross-Reference: Compare insights here with the player's and other parent's introductory transcripts to get a fuller picture. Note any areas of alignment or divergence in perspectives.\n`;
    content += `4.  Sensitive Topics: Be mindful of any sensitive information shared (e.g., financial constraints) and handle it with discretion, using it to guide realistic advice without explicitly referencing the parent's exact statements unless appropriate and speaking to that parent.\n\n`;
    content += formatSingleTranscriptSegment(transcript);
    content += `--- End of ${parentTitle} Introductory Meeting Transcript ---\n`;
    return content;
  };

  const formatPreviousMainSessionsForPrompt = (
    sessions: AppTranscriptMessage[][], 
    currentInteractingRole: 'player' | 'parent1' | 'parent2'
  ): string => {
    if (!sessions || sessions.length === 0) return "";

    const userName = currentInteractingRole === 'player' ? PLAYER_NAME_CONST : 
                     currentInteractingRole === 'parent1' ? PARENT_1_NAME_CONST : PARENT_2_NAME_CONST;
    const userRoleTitle = currentInteractingRole.charAt(0).toUpperCase() + currentInteractingRole.slice(1);
    const forPlayerContext = currentInteractingRole !== 'player' ? ` regarding Player (${PLAYER_NAME_CONST})` : '';


    let content = `\n\n--- Appended: History of Previous Main Advisory Sessions with ${userRoleTitle} (${userName})${forPlayerContext} ---\n`;
    content += `The following are transcripts from all previous main advisory session segments Blue has had directly with ${userName}. These conversations built upon earlier discussions (including introductory meetings) and focused on ongoing advice, goal tracking, problem-solving, and evolving aspects of their hockey journey${forPlayerContext}. They are presented in chronological order.\n\n`;
    
    if (currentInteractingRole === 'player') {
        content += `Instructions for using this History of Previous Player Main Sessions:\n`;
        content += `1.  Overall Continuity & Context: Review this entire history to understand the trajectory of your advisory relationship with ${userName}. Identify recurring themes, evolving goals, advice given, and progress made over time.\n`;
        content += `2.  Recall Key Milestones & Decisions: Note significant decisions made, challenges overcome, or advice that was particularly impactful in past sessions.\n`;
        content += `3.  Avoid Repetition, Build Progression: Ensure your current advice builds upon, rather than repeats, previous discussions unless reinforcement is strategically needed. Refer to past agreements or action items to check on progress.\n`;
        content += `4.  Identify Long-Term Patterns: Look for patterns in the player's development, challenges, or responses to advice across these sessions to inform your current strategy.\n`;
        content += `5.  Reference Specific Past Segments if Necessary: While reviewing the whole, if a very specific point from a particular past segment is highly relevant, you can mentally note it, but your primary approach should be holistic understanding from the entire main session history.\n\n`;
    } else { // For Parents
        content += `Instructions for using this History of Previous Parent Main Sessions:\n`;
        content += `1.  Overall Continuity & Context for Parent: Review this entire history to understand the trajectory of your advisory relationship with ${userName}. Identify recurring themes in their concerns, evolving family strategies, advice given to them, and their reported outcomes.\n`;
        content += `2.  Recall Key Parental Insights & Actions: Note significant insights shared by the parent, strategies they planned to implement, or challenges they were working through regarding the player or family dynamics.\n`;
        content += `3.  Avoid Repetition, Build Progression with Parent: Ensure your current advice to ${userName} builds upon previous discussions. Refer to past agreements or action items they mentioned to check on progress or changes in perspective.\n`;
        content += `4.  Identify Long-Term Patterns in Parental Support: Look for patterns in how ${userName} approaches supporting the player, their common questions, or their responses to advice across these sessions to inform your current strategy for advising them.\n`;
        content += `5.  Holistic Understanding of Parent's Journey: Use this collective history to tailor your support specifically to ${userName}'s ongoing needs and their role in the player's development.\n\n`;
    }

    sessions.forEach((sessionTranscript, index) => {
      content += `--- Main Session Segment ${index + 1} with ${userRoleTitle} (${userName}) ---\n`;
      content += formatSingleTranscriptSegment(sessionTranscript);
      content += `--- End of Main Session Segment ${index + 1} with ${userRoleTitle} ---\n\n`;
    });
    content += `--- End of Appended History of Previous Main Advisory Sessions with ${userRoleTitle} ---\n`;
    return content;
  };


  const handleProceedToChat = () => {
    if (!selectedRoleForCard) return;
    setIsLoadingContent(true);

    if (currentStage === 'introductory' && !introTranscripts[selectedRoleForCard]) {
      const content = ROLE_CONTENTS_INTRO[selectedRoleForCard];
      if (content) {
        setCurrentChatPromptAndGreeting({ prompt: content.systemPrompt, greeting: content.greeting });
        setActiveChatRole(selectedRoleForCard);
      } else { console.error("Intro content not found for role:", selectedRoleForCard); }
    } else if (currentStage === 'mainSession' && canProceedToMainSession) {
      const mainContent = ROLE_CONTENTS_MAIN[selectedRoleForCard];
      if (mainContent) {
        let combinedPrompt = mainContent.baseSystemPrompt;
        
        // Append INTRO transcripts with new formatting
        if (introTranscripts['player']) {
          combinedPrompt += formatPlayerIntroTranscriptForPrompt(introTranscripts['player']);
        }
        if (introTranscripts['parent1']) {
          combinedPrompt += formatParentIntroTranscriptForPrompt(introTranscripts['parent1'], 'parent1');
        }
        if (introTranscripts['parent2']) {
          combinedPrompt += formatParentIntroTranscriptForPrompt(introTranscripts['parent2'], 'parent2');
        }

        // Append PREVIOUS MAIN session transcripts for the current role with new formatting
        const previousMainSessionsForRole = mainSessionTranscripts[selectedRoleForCard] || [];
        if (previousMainSessionsForRole.length > 0) {
            combinedPrompt += formatPreviousMainSessionsForPrompt(
                previousMainSessionsForRole, 
                selectedRoleForCard as 'player' | 'parent1' | 'parent2' // Type assertion
            );
        }
        
        combinedPrompt += `\n\n--- End of Appended Transcripts. Begin Current Main Conversation Segment for ${selectedRoleForCard}. ---`;
        
        //console.log(`Combined Prompt for Main Session (${selectedRoleForCard}):`, combinedPrompt);
        
        let greeting = mainContent.greeting;
        if (previousMainSessionsForRole.length > 0) {
            const roleTitle = roles.find(r => r.id === selectedRoleForCard)?.title || selectedRoleForCard;
            greeting = `Welcome back, ${roleTitle}! Let's continue our discussion. What's on your mind?`;
        }

        setCurrentChatPromptAndGreeting({ prompt: combinedPrompt, greeting: greeting });
        setActiveChatRole(selectedRoleForCard);
      } else { console.error("Main content not found for role:", selectedRoleForCard); }
    } else {
      console.log("Cannot proceed to chat. Stage:", currentStage, "Role:", selectedRoleForCard, 
                  "Intro completed for this role:", !!introTranscripts[selectedRoleForCard], 
                  "Can proceed to main:", canProceedToMainSession);
    }
    setIsLoadingContent(false);
  };

  // ... (handleIntroChatEnded, handleMainChatEnded, handleViewIntroTranscript, handleViewMainTranscripts, handleCloseTranscriptModal, switchToMainSessionStage, switchToIntroductoryStage remain the same) ...
  const handleIntroChatEnded = (transcript: AppTranscriptMessage[]) => {
    const roleThatEnded = activeChatRole; 
    if (roleThatEnded) {
      setIntroTranscripts(prev => ({ ...prev, [roleThatEnded]: transcript }));
    }
    setActiveChatRole(null);
    setCurrentChatPromptAndGreeting(null);
  };

  const handleMainChatEnded = (mainSessionSegmentTranscript: AppTranscriptMessage[]) => {
    const roleThatEnded = activeChatRole;
    if (roleThatEnded && mainSessionSegmentTranscript.length > 0) {
      setMainSessionTranscripts(prev => {
        const existingSessions = prev[roleThatEnded] || [];
        return { ...prev, [roleThatEnded]: [...existingSessions, mainSessionSegmentTranscript] };
      });
    }
    setActiveChatRole(null);
    setCurrentChatPromptAndGreeting(null);
  };

  const handleViewIntroTranscript = (roleId: string) => { 
    if (introTranscripts[roleId]) {
      setViewingTranscriptForRole(roleId);
      setViewingTranscriptType('intro');
      setCurrentMainTranscriptToView(null);
      setIsTranscriptModalOpen(true);
    }
  };
  const handleViewMainTranscripts = (roleId: string) => { 
    const sessions = mainSessionTranscripts[roleId];
    if (sessions && sessions.length > 0) {
      setViewingTranscriptForRole(roleId);
      setViewingTranscriptType('main');
      // Show the latest main session segment in the modal by default
      setCurrentMainTranscriptToView(sessions[sessions.length - 1]); 
      setIsTranscriptModalOpen(true);
    } else {
      alert("No main session transcripts available for this role yet.");
    }
  };
  const handleCloseTranscriptModal = () => { 
    setIsTranscriptModalOpen(false);
    setViewingTranscriptForRole(null);
    setViewingTranscriptType(null);
    setCurrentMainTranscriptToView(null);
  };

  const switchToMainSessionStage = () => { 
    if (canProceedToMainSession) {
      setCurrentStage('mainSession');
      setSelectedRoleForCard(null); 
    } else {
      alert("Please complete the introductory chat for the Player and at least one Parent before proceeding.");
    }
  };
  const switchToIntroductoryStage = () => { 
    setCurrentStage('introductory');
    setSelectedRoleForCard(null);
  };


  let ChatComponentToRender = null;
  if (activeChatRole && currentChatPromptAndGreeting) {
    if (currentStage === 'introductory') {
      ChatComponentToRender = (
        <IntroductoryChat
          key={`${activeChatRole}-intro`} 
          personalizedPrompt={currentChatPromptAndGreeting.prompt}
          greeting={currentChatPromptAndGreeting.greeting}
          language="en"
          onChatEnd={handleIntroChatEnded}
        />
      );
    } else if (currentStage === 'mainSession') {
      ChatComponentToRender = (
        <MainConversation
          key={`${activeChatRole}-main-${(mainSessionTranscripts[activeChatRole] || []).length}`}
          systemPromptWithTranscripts={currentChatPromptAndGreeting.prompt}
          greeting={currentChatPromptAndGreeting.greeting}
          language="en"
          onChatEnd={handleMainChatEnded}
        />
      );
    }
  }

  if (ChatComponentToRender) {
    return ChatComponentToRender;
  }

  let transcriptForModal: AppTranscriptMessage[] | undefined = undefined;
  if (viewingTranscriptForRole) {
    if (viewingTranscriptType === 'intro') {
      transcriptForModal = introTranscripts[viewingTranscriptForRole];
    } else if (viewingTranscriptType === 'main' && currentMainTranscriptToView) {
      transcriptForModal = currentMainTranscriptToView;
    }
  }
  const modalTitle = viewingTranscriptForRole ? 
    `${roles.find(r => r.id === viewingTranscriptForRole)?.title || 'N/A'} - ${viewingTranscriptType === 'intro' ? 'Intro' : `Ask Blue (Latest)`} Transcript`
    : 'Transcript';

  return (
    <>
      <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-100 to-white px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full max-w-4xl text-center">
          <LogoHeader />
          <div className="my-6 flex justify-center items-center gap-4">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800">
              {currentStage === 'introductory' 
                ? (canProceedToMainSession ? "Intro Chats Done - Ready for Ask Blue!" : "Setup: Introductory Chats")
                : "Ask Blue Session"}
            </h1>
            <Tooltip 
              content={currentStage === 'introductory' ? "Switch to Ask Blue (if prerequisites met)" : "Back to Intro Chat Setup"}
              placement="top"
            >
              <NextUIButton isIconOnly variant="light" onPress={currentStage === 'introductory' ? switchToMainSessionStage : switchToIntroductoryStage} disabled={currentStage === 'introductory' && !canProceedToMainSession}>
                {currentStage === 'introductory' ? <ArrowRight size={24} /> : <RefreshCw size={24} />}
              </NextUIButton>
            </Tooltip>
          </div>

          <p className="text-lg text-gray-600 mb-10 sm:mb-12">
            {currentStage === 'introductory' 
              ? (canProceedToMainSession 
                  ? "Player and at least one Parent have completed their intro chats. You can review transcripts or switch to the Ask Blue Session." 
                  : "Please complete the Player's and at least one Parent's introductory chat with Blue.")
              : "Select a role to start a Ask Blue session. Blue will use context from all available introductory and previous Ask Blue chats."}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8">
            {roles.map((role) => (
              <RoleCard
                key={role.id}
                title={role.title}
                icon={role.icon}
                isSelected={selectedRoleForCard === role.id}
                onSelect={() => handleRoleCardSelect(role.id)}
                isIntroChatCompleted={!!introTranscripts[role.id]}
                mainChatCount={(mainSessionTranscripts[role.id] || []).length}
                onViewIntroTranscript={() => handleViewIntroTranscript(role.id)}
                onViewMainTranscripts={() => handleViewMainTranscripts(role.id)}
                currentStage={currentStage}
                allIntroChatsDoneForMainSession={canProceedToMainSession}
              />
            ))}
          </div>

          {selectedRoleForCard && !activeChatRole && 
           ((currentStage === 'introductory' && !introTranscripts[selectedRoleForCard]) || 
            (currentStage === 'mainSession' && canProceedToMainSession)) && (
            <div className="mt-12">
              <NextUIButton
                size="lg"
                color="primary"
                className={`bg-[${graetBlue}] text-white font-semibold`}
                isLoading={isLoadingContent}
                onPress={handleProceedToChat}
                endContent={currentStage === 'mainSession' ? <MessageCircle size={20}/> : <ArrowRight size={20} />}
              >
                {isLoadingContent ? "Loading..." : 
                  (currentStage === 'introductory' 
                    ? `Start Intro for ${roles.find(r => r.id === selectedRoleForCard)?.title}`
                    : `Chat with ${roles.find(r => r.id === selectedRoleForCard)?.title} (Main)`)
                }
              </NextUIButton>
            </div>
          )}
          
          <div className="mt-8 text-xs text-gray-500 p-4 border border-dashed border-gray-300 rounded">
            <h4 className="font-semibold mb-2">Introductory Transcript Status (Debug):</h4>
            {roles.map(role => (
              <p key={role.id}>{role.title} Intro: {introTranscripts[role.id] ? `Captured (${introTranscripts[role.id].length} messages)` : 'Not yet'}</p>
            ))}
            <h4 className="font-semibold mb-1 mt-2">Ask Blue Transcripts (Segments):</h4>
            {roles.map(role => (
              <p key={`${role.id}-main`}>{role.title} Main: {(mainSessionTranscripts[role.id] || []).length} segments captured</p>
            ))}
            <p className="mt-2 font-medium">Can Proceed to Main Session: {canProceedToMainSession ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </main>

      {isTranscriptModalOpen && transcriptForModal && (
        <TranscriptModal
          isOpen={isTranscriptModalOpen}
          onClose={handleCloseTranscriptModal}
          transcript={transcriptForModal}
          roleTitle={modalTitle}
        />
      )}
    </>
  );
}