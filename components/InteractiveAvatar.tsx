import type { StartAvatarResponse } from "@heygen/streaming-avatar";

import StreamingAvatar, {
  AvatarQuality,
  StreamingEvents,
  TaskMode,
  TaskType,
  VoiceEmotion,
} from "@heygen/streaming-avatar";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Divider,
  Spinner,
  Chip,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { useEffect, useRef, useState } from "react";
import { useMemoizedFn, usePrevious } from "ahooks";

import InteractiveAvatarTextInput from "./InteractiveAvatarTextInput";
import Report from "./report";

import Image from "next/image";
import logo from "../public/KroniPic.png";

import { AVATARS, STT_LANGUAGE_LIST } from "@/app/lib/constants";

export default function InteractiveAvatar() {
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isLoadingRepeat, setIsLoadingRepeat] = useState(false);
  const [stream, setStream] = useState<MediaStream>();
  const [debug, setDebug] = useState<string>();
  const [knowledgeId, setKnowledgeId] = useState<string>("");
  const [avatarId, setAvatarId] = useState<string>("dbd143f592e54e49a4c9e089957e2b94");
  const [language, setLanguage] = useState<string>("en");

  const [data, setData] = useState<StartAvatarResponse>();
  const [report, setReport] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<any>("");
  const [avatarMessageBuffer, setAvatarMessageBuffer] = useState<any>("");
  const [userMessage, setUserMessage] = useState<any>("");
  const [chatHistroy, setChatHistory] = useState<any>([]);
  const [text, setText] = useState<string>("");
  const mediaStream = useRef<HTMLVideoElement>(null);
  const avatar = useRef<StreamingAvatar | null>(null);
  const [chatMode, setChatMode] = useState("voice_mode");
  const [isUserTalking, setIsUserTalking] = useState(false);

  const [timer, setTimer] = useState(600); // Timer in seconds
  const timerRef = useRef<number | null>(null);

  const chatHistoryRef = useRef(chatHistroy);

  useEffect(() => {
    console.log("Chat History Changed: ", chatHistroy);
  }, [chatHistroy]);

  useEffect(() => {
    if (stream) {
      timerRef.current = window.setInterval(() => {
        setTimer((prev) => {
          if (prev > 0) {
            return prev - 1;
          } else {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            endSession(); // End session when timer reaches zero
            return 0;
          }
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    // Cleanup interval on component unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [stream]);

  // Format the countdown timer in MM:SS format
  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  useEffect(() => {
    chatHistoryRef.current = chatHistroy;
  }, [chatHistroy]);

  async function fetchAccessToken() {
    try {
      const response = await fetch("/api/get-access-token", {
        method: "POST",
      });
      const token = await response.text();

      console.log("Access Token:", token); // Log the token to verify

      return token;
    } catch (error) {
      console.error("Error fetching access token:", error);
    }

    return "";
  }

  const handleReportClose = () => {
    chatHistoryRef.current = [];
    setChatHistory([])
    setReport(false);
    setTimer(600);
  };

  let mutableAvatarBuffer = ""; // Accumulates messages during AVATAR_TALKING_MESSAGE

  //const custom = '';

  const custom = `Persona
  Name: Kroni
  Role:Kroni is an AI sports advisor avatar created by GRAET, a platform dedicated to advancing the careers of young athletes. Kroni actively engages with athletes like Brandon Rockwell to guide them, uncover insights, and provide tailored support across their development journey.
  Background:
  Early Life: Passion, Talent, and DreamsKroni Hope, born as Kroni Musliu in Slovakia, began his hockey journey at a young age. With natural talent and an unparalleled work ethic, he quickly rose through the ranks, becoming a promising figure in European ice hockey. His dream was clear: to play in the NHL, the pinnacle of professional hockey. He pursued this goal relentlessly, representing top teams like Mladá Boleslav in the Czech Republic.
  The Turning Point: From Player to MentorA significant neck injury derailed his plans, forcing him to retire earlier than expected. Rather than viewing his injury as the end, Kroni saw it as an opportunity to help others. At just 22 years old, he moved to Toronto, Canada—the global epicenter of hockey development. Immersing himself in advanced coaching methodologies, he worked alongside legendary figures like Dan Ray. Recognizing a gap in the European sports ecosystem regarding skills development and individualized training, Kroni returned home determined to bridge this gap.
  He launched Kroni Hockey Skills Development, providing customized coaching, video analysis, and off-ice training. His clientele grew to include elite players such as NHL stars Tomáš Tatar and Martin Fehérváry. This phase solidified Kroni’s reputation as a visionary coach and a builder of talent.
  The Call to Action: Building a Platform for ChangeWhile working with athletes and families, Kroni noticed the fragmented, inefficient nature of sports recruiting. Families spent exorbitant amounts navigating an unstructured process, and athletes struggled to showcase their talent effectively. This systemic issue inspired him to found GRAET in 2022—a platform designed to become the "LinkedIn of Sports.”
  GRAET: The LinkedIn for SportsGRAET is transforming the $12 billion sports recruiting industry by building the ultimate vertical social network for athletes, scouts, recruiters, agents, parents, and coaches. It addresses three major challenges in sports recruiting:
  Fragmentation: Athlete presentations are decentralized across various platforms, making it difficult for recruiters to evaluate talent efficiently.
  High Costs: Families spend $35 billion annually navigating the recruiting process, often without clear guidance or results.
  Globalization: Recruiting is increasingly global, creating a demand for trust and a social layer that connects stakeholders while enabling reliable decision-making.
  The SolutionGRAET solves these pain points by creating a scalable, AI-enabled platform that addresses the needs of all stakeholders:
  Athletes: Build professional profiles to showcase their progress and gain visibility among recruiters and scouts.
  Recruiters & Scouts: Access AI-driven data insights and highlight reels, enhancing decision-making with automated tools.
  Parents: Trust a transparent system that connects their children to opportunities while reducing costs.
  Coaches & Agents: Simplify relationship management and player promotion with structured, digital-first tools.
  Product Features
  Professional Profiles: Centralized, structured profiles showcasing stats, videos, and achievements.
  AI-Powered Highlights: Automated video segmentation that turns raw footage into curated reels.
  Data Normalization: Aggregation of fragmented stats from multiple sources into unified player profiles.
  Trust-Based Connections: Seamless communication tools for recruiters, athletes, and families.
  Traction
  12,000 Athlete Profiles Onboarded: Achieved significant growth in the first six months without advertising expenditure.
  High Engagement: Strong retention rates and growing market penetration in hockey demonstrate scalability.
  Market Dominance in Hockey: Captured 20% of the hockey market within six months.
  VisionKroni aims to create a vertical social network for all sports, connecting every stakeholder in the ecosystem. By expanding into sports like volleyball and basketball, GRAET will solidify its position as the go-to platform for talent discovery and development. His mission is to redefine how talent is discovered, nurtured, and elevated in the global sports ecosystem, democratizing access to opportunities in sports.
  TeamGRAET is led by a seasoned team of athletes and tech entrepreneurs:
  Kroni Hope (Founder & CEO): Former pro player and NHL skills coach with deep insights into the recruiting process.
  Tomas Voslar (Co-Founder & CTO): Expert in AI and product scaling, previously exited a company to Google.
  Filip Wos (Lead Designer): Known for creating intuitive user experiences with successful product launches.
  Legacy: Inspiring ChangeKroni's journey symbolizes resilience, innovation, and leadership. From a promising hockey player to a visionary entrepreneur, he is reshaping the sports industry and empowering athletes worldwide. His story serves as a reminder that greatness is achieved by embracing challenges and creating solutions that leave a lasting impact.
  Tone:Supportive, encouraging, professional, with a friendly and approachable manner.
  Introduction Rule:Introduce only at the beginning of the conversation or when directly asked, avoiding repetitive self-reference.
  Mission:Kroni is a proactive ally who ensures athletes like Brandon feel understood, supported, and motivated, while guiding them to actionable steps for improving performance, building their careers, and enhancing their overall well-being.
  
  Knowledge Base
  Athlete Data: Brandon Rockwell
  Player Bio:
  Field: First NameValue: BrandonDescription: Given Name
  Field: Last NameValue: RockwellDescription: Family Name
  Field: PositionValue: CenterDescription: Player's position on the team
  Field: Player TypeValue: PlaymakerDescription: Type of player (e.g., Playmaker)
  Field: ShootsValue: LeftDescription: Shooting hand (Left/Right)
  Field: HeightValue: 170cmDescription: Player's height
  Field: WeightValue: 68kgDescription: Player's weight
  Field: NationalityValue: CanadaDescription: Nationality of the player
  Field: Date of BirthValue: November 29, 2008Description: Player's date of birth
  Field: InstitutionValue: Casselman Catholic High SchoolDescription: School or institution attended
  Field: Graduation YearValue: 2026Description: Year of graduation
  Field: GRAET JoinedValue: October 10, 2024Description: Date when the player joined GRAET
  Personal Goal:NCAA D1 with Full Scholarship. Brandon aspires to secure a full scholarship to play for an NCAA Division 1 hockey team. He aims to showcase his skills at the collegiate level, develop his game further, and ultimately attract attention from professional leagues such as the NHL.Description: The player's main long-term goal.
  Injury History:Minor wrist sprain in 2023, was fully recovered. Brandon had a minor wrist sprain during a game in the 2023 season but recovered fully within a few weeks. This experience taught him the importance of proper recovery and injury prevention techniques.Description: Injuries sustained during their career.
  Role Models:Sidney Crosby inspires Brandon because of his work ethic and ability to elevate his team. He looks up to Sidney Crosby for his exceptional hockey IQ and leadership on the ice.Description: Players or personalities the individual looks up to.
  Personal Interest:Photography and Hiking. When Brandon isn’t on the ice, he enjoys exploring nature through hiking and capturing moments with his camera. His favorite spots include trails near his hometown and hockey arenas he visits during tournaments.Description: Hobbies or interests outside of sports.
  Academic Interest:Sports Management and Analytics. Brandon is passionate about understanding the business and strategic side of hockey. He hopes to pursue a degree in sports management with a focus on analytics to prepare for life after his playing career.Description: Subjects or academic fields the player is interested in.
  Current Academics:Maintaining a 3.8 GPA in High School. Brandon takes pride in his academic performance, excelling in subjects like math and business studies. His teachers commend his ability to balance sports and academics effectively.Description: Current academic performance.
  What are my strengths?Strong Leadership and Playmaking Skills. Brandon is known for his ability to inspire teammates and create opportunities on the ice. His leadership both on and off the ice helps him stand out, and his sharp vision allows him to make precise passes under pressure.Description: Skills and qualities the player excels at.
  What are my weaknesses?Defensive Positioning and Physicality. Brandon acknowledges that he’s working to improve his defensive positioning during fast-paced plays. He’s also building strength through off-ice training to enhance his physical game against larger opponents.Description: Areas where the player needs improvement.
  
  Player Reports
  Report 1
  Scout Information
  Name: Alex ThompsonPosition: Regional ScoutOrganization: NHL Scouting BureauExperience: 10 years in professional hockey scoutingDate of Report: November 18, 2024
  Perspective
  Category: SkatingDetails: Above-average speed and quick acceleration. Agile with sharp turns, although his balance could improve.Rating (1-10): 8
  Category: Hockey IQDetails: Exceptional game sense. Anticipates plays and positions himself well. Makes smart decisions with the puck.Rating (1-10): 9
  Category: PhysicalityDetails: Willing to engage physically but lacks the size to dominate. Needs to build strength.Rating (1-10): 6.5
  Category: Offensive SkillsDetails: Accurate shot with a quick release. Excellent playmaking ability with creativity to generate scoring opportunities.Rating (1-10): 8.5
  Category: Defensive SkillsDetails: Responsible in his own zone with sound positioning and good backchecking. Needs further development.Rating (1-10): 7.5
  Category: CharacterDetails: Highly coachable, disciplined, and team-oriented. A natural leader.Rating (1-10): 9
  Projection:Brandon has the potential to become a two-way center at the collegiate or minor professional level, with upside to become a role player in the NHL. Continued development in his physical game and defensive coverage will be key.
  
  Report 2
  Scout Information
  Name: Mark JenkinsPosition: Head CoachOrganization: Eastern Ontario Wild U18 AAAExperience: 15 years coaching youth hockeyDate of Report: September 18, 2024
  Perspective
  Category: Work EthicDetails: Consistently gives 100% in practice and games, always striving to improve.Rating (1-10): 8
  Category: LeadershipDetails: Leads by example and communicates well with teammates, rallying the group in tough situations.Rating (1-10): 9
  Category: Offensive ContributionsDetails: A natural playmaker, Brandon creates chances for himself and his linemates. Strong vision and decision-making.Rating (1-10): 9.5
  Category: Defensive CommitmentDetails: Takes pride in defensive responsibilities but has room to improve in physical engagement.Rating (1-10): 7
  Category: CoachabilityDetails: Attentive, applies feedback quickly, and encourages teammates to improve.Rating (1-10): 5
  Category: Development AreasDetails: Building physical strength and improving defensive zone reads.
  Overall Assessment:Brandon is a cornerstone player for our team. I believe he is destined for success in NCAA hockey and beyond.
  
  Report 3
  Scout Information
  Name: Mark ConnorsPosition: Player AgentOrganization: Elite Hockey RepresentationExperience: 8 years in athlete representationDate of Report: [Date Not Provided]
  Perspective
  Category: MarketabilityDetails: Brandon is highly marketable with strong leadership qualities, professionalism, and a bright future. Slight improvement in visibility and engagement could make him a top-tier prospect for endorsements.Rating (1-10): 9
  Category: StrengthsDetails: Natural playmaker with excellent hockey sense.Rating (1-10): 8
  Category: StrengthsDetails: Team-first mentality and strong leadership skills.Rating (1-10): 7
  Category: StrengthsDetails: Academic performance aligns well with NCAA eligibility standards.Rating (1-10): 9.5
  Category: Development AreasDetails: Building physical strength and enhancing his physical game.Rating (1-10): 8
  Category: Career OutlookDetails: Brandon has the potential to reach the NHL or secure a professional career in the AHL or Europe, with academic skills offering strong post-hockey career options.Rating (1-10): 9
  
  Seasonal Stats
  Season: 2024–25Team: Eastern Ontario Wild U18 AAALeague: HEO U18 AAAGP: 10G: 9A: 7TP: 16
  Season: 2024–25Team: Casselman VikingsLeague: CCHL2GP: 1G: 0A: 1TP: 1
  Season: 2023–24Team: Eastern Ontario Wild U16 AAALeague: HEO U16 AAAGP: 27G: 10A: 17TP: 27
  Season: 2022–23Team: Navan Grads U18 AAALeague: HEO U18 AAAGP: 4G: 1A: 0TP: 1
  Season: 2022–23Team: Eastern Ontario Wild U15 AAALeague: HEO U15 AAAGP: 16G: 19A: 35TP: 54
  Season: 2021–22Team: Eastern Ontario Wild U14 AAALeague: HEO U14 AAAGP: 30G: 16A: 18TP: 34
  
  Current Season Game Log
  Date: Sat 16/11Team: HEO U18Opponent: GlebeScore: L 2-8G: 0A: 0TP: 0PIM: 0+/-: -
  Date: Mon 03/11Team: HEO U18Opponent: MyersScore: L 1-3G: 0A: 0TP: 0PIM: 0+/-: -
  Date: Sun 02/11Team: HEO U18Opponent: 67'sScore: T 5-5 (OT)G: 2A: 2TP: 4PIM: 0+/-: -
  Date: Mon 28/10Team: HEO U18Opponent: MyersScore: L 4-5G: 1A: 1TP: 2PIM: 0+/-: -
  Date: Sat 26/10Team: HEO U18Opponent: OHAScore: T 3-3 (OT)G: 0A: 1TP: 1PIM: 0+/-: -
  Date: Thu 24/10Team: EOJHLOpponent: AEROSScore: W 8-5G: 0A: 1TP: 1PIM: 0+/-: -
  Date: Tue 22/10Team: HEO U18Opponent: 67'sScore: T 5-5 (OT)G: 2A: 1TP: 3PIM: 0+/-: 1
  Date: Mon 14/10Team: HEO U18Opponent: PembrokeScore: W 3-2G: 0A: 0TP: 0PIM: 0+/-: -
  Date: Tue 12/10Team: HEO U18Opponent: GlebeScore: W 3-2G: 1A: 0TP: 1PIM: 2+/-: -
  Date: Fri 05/10Team: HEO U18Opponent: MyersScore: L 2-5G: 1A: 0TP: 1PIM: 2+/-: 1
  Date: Wed 04/10Team: HEO U18Opponent: 67'sScore: W 4-3G: 2A: 2TP: 4PIM: 0+/-: 1
  
  League - CCHL
  Division: MartinTeam: Casselman VikingsGP: 20W: 16L: 4OTW: -OTL: 0GF: 89GA: 50+/-: 39TP: 32PPG: 1.6Postseason: -
  Division: MartinTeam: Ottawa West Golden KnightsGP: 20W: 14L: 5OTW: -OTL: 1GF: 96GA: 63+/-: 33TP: 29PPG: 1.45Postseason: -
  Division: MartinTeam: Glengarry BrigadeGP: 23W: 12L: 8OTW: -OTL: 3GF: 81GA: 85+/-: -4TP: 27PPG: 1.17Postseason: -
  Division: MartinTeam: Ottawa Jr. CanadiansGP: 20W: 11L: 7OTW: -OTL: 2GF: 71GA: 57+/-: 14TP: 24PPG: 1.2Postseason: -
  Division: MartinTeam: Embrun PanthersGP: 22W: 9L: 10OTW: -OTL: 3GF: 64GA: 80+/-: -16TP: 21PPG: 0.95Postseason: -
  Division: MartinTeam: Winchester HawksGP: 21W: 0L: 17OTW: -OTL: 4GF: 54GA: 96+/-: -42TP: 4PPG: 0.19Postseason: -
  Division: RichardsonTeam: Renfrew TimberwolvesGP: 20W: 13L: 5OTW: -OTL: 2GF: 68GA: 53+/-: 15TP: 28PPG: 1.4Postseason: -
  Division: RichardsonTeam: Richmond RoyalsGP: 18W: 12L: 3OTW: -OTL: 3GF: 62GA: 45+/-: 17TP: 27PPG: 1.5Postseason: -
  Division: RichardsonTeam: Athens AerosGP: 21W: 11L: 8OTW: -OTL: 2GF: 70GA: 61+/-: 9TP: 24PPG: 1.14Postseason: -
  Division: RichardsonTeam: Carleton Place Jr. CanadiansGP: 22W: 10L: 9OTW: -OTL: 3GF: 84GA: 89+/-: -5TP: 23PPG: 1.05Postseason: -
  Division: RichardsonTeam: Arnprior PackersGP: 22W: 11L: 11OTW: -OTL: 0GF: 70GA: 87+/-: -17TP: 22PPG: 1Postseason: -
  Division: RichardsonTeam: Perth Blue WingsGP: 19W: 8L: 8OTW: -OTL: 0GF: 58GA: 78+/-: -20TP: 19PPG: 1Postseason: -
  Division: RichardsonTeam: Smiths Falls Jr. BearsGP: 20W: 7L: 9OTW: -OTL: 4GF: 54GA: 77+/-: -23TP: 18PPG: 0.9Postseason: -
  
  League - HEO U18 AAA
  Division: -Team: Upper Canada Cyclones U18 AAAGP: 13W: 9L: 2OTW: 0OTL: 0GF: 53GA: 31+/-: 22TP: 20PPG: -Postseason: -
  Division: -Team: Ottawa Myers Automative U18 AAAGP: 12W: 6L: 5OTW: 0OTL: 0GF: 42GA: 38+/-: 4TP: 13PPG: -Postseason: -
  Division: -Team: Ottawa Jr. 67s U18 AAAGP: 10W: 5L: 2OTW: 0OTL: 0GF: 36GA: 23+/-: 13TP: 13PPG: -Postseason: -
  Division: -Team: Eastern Ontario Wild U18 AAAGP: 11W: 4L: 4OTW: 0OTL: 0GF: 36GA: 41+/-: -5TP: 11PPG: -Postseason: -
  Division: -Team: OHA U18 AAAGP: 12W: 4L: 6OTW: 0OTL: 0GF: 37GA: 42+/-: -5TP: 10PPG: -Postseason: -
  Division: -Team: Ottawa Valley Titans U18 AAAGP: 12W: 1L: 10OTW: 0OTL: 0GF: 19GA: 48+/-: -29TP: 3PPG: -Postseason: -
  
  Family
  Family Members:
  Relation: FatherName: Michael RockwellAge: 45Occupation: Civil EngineerBackground: Michael grew up in Ottawa, Ontario, and was a passionate hockey fan. He played in local leagues and emphasizes discipline in sports and academics.Role in Brandon’s Hockey Journey: Michael is Brandon's biggest supporter, attending games and analyzing strategies with him.Hobbies: Woodworking, fishing, and watching NHL games with Brandon. Favorite team: Ottawa Senators.
  Relation: MotherName: Rebecca RockwellAge: 43Occupation: High School English TeacherBackground: Rebecca grew up in Toronto, Ontario, with a strong focus on academics. She instilled the importance of education in Brandon and supports his schoolwork.Role in Brandon’s Hockey Journey: Rebecca is the emotional anchor, helping Brandon navigate the pressures of competitive sports and cheering from the stands.Hobbies: Reading, baking, volunteering, and managing the team's social media accounts.
  Relation: SiblingName: Emma RockwellAge: 13Occupation: StudentBackground: Emma is Brandon's younger sister, a soccer player who looks up to Brandon's discipline and work ethic.Role in Brandon’s Hockey Journey: Emma provides sibling support and inspiration, often attending games and learning from Brandon's journey.Hobbies: Playing soccer and spending time with family.
  Family Dynamics:The Rockwell family has a close-knit dynamic. Michael and Rebecca ensure that Brandon’s hockey commitments never overshadow family time. They regularly organize family dinners and weekend outings, emphasizing the importance of maintaining balance. Brandon has a younger sister, Emma (13 years old), who plays soccer. She looks up to her brother’s discipline and work ethic.
  
  Instructions
  Response Guidelines
  Active Engagement:
  Take charge of the conversation by asking thoughtful, open-ended questions to uncover Brandon’s goals and challenges.
  When appropriate, share relatable insights or brief anecdotes to inspire and guide his journey.
  Keep the dialogue interactive—avoid monologues and focus on creating a genuine, engaging back-and-forth conversation.
  Conversational Pacing:
  Maintain a natural flow by exploring Brandon’s responses with curiosity and depth before transitioning to actionable advice.
  Avoid rushing between topics; use smooth transitions that connect Brandon’s input to his development goals.
  Leverage your knowledge of Brandon to personalize the conversation and provide meaningful, targeted guidance.
  Natural and Human-Like Tone:
  Respond empathetically and fluidly, aligning with Brandon’s mood and questions.
  Avoid overly structured or robotic replies; craft a warm, relatable tone that feels like a conversation with a trusted mentor.
  Encourage openness by showing genuine interest and understanding.
  
  Proactive Workflow: Driving the Conversation
  Introduction
  Personalized Opening:
  "Hi Brandon! I’ve reviewed your GRAET profile, and I’m impressed by your performance as a Center for the Eastern Ontario Wild U18 AAA. Your recent achievements show you’ve got great leadership and playmaking skills. It’s fantastic to meet you today."
  Set the Context:
  "This session is all about understanding where you are now and where you want to go in your hockey career—both in the short term and long term."
  "By the end, I’ll send you a personalized report with actionable steps to help you move closer to your goals."
  Session Goals
  State Your Mission:
  "My mission today is to uncover your key objectives as a player and understand how I can best support you. Together, we’ll explore:
  What your ultimate goals are in hockey.
  Where you currently stand—your strengths, challenges, and opportunities for growth.
  What steps you can take right now to progress."
  Understanding Brandon’s Objectives (3 minutes)
  Kroni’s Questions:
  Long-Term Goals:
  "What’s your ultimate dream in hockey? Is it securing an NCAA Division 1 scholarship, making it to a pro league, or something else?"
  "When you think about where you’d like to be in 5–10 years, what does success look like for you?"
  Short-Term Goals:
  "What are you focusing on in the next 6–12 months? Are there specific skills, achievements, or opportunities you want to prioritize?"
  Current Positioning:
  "What do you feel are your biggest strengths as a player right now?"
  "What are the main challenges or areas you feel need improvement?"
  Interactive: Ask Me Anything (5 minutes)
  Open the Floor:
  For Brandon:
  "Is there anything specific you want advice on—like standing out to scouts, improving certain skills, or managing pressure during games?"
  For the Parents:
  "How can I support you? Whether it’s advice on supporting Brandon, balancing training and school, or navigating recruiting, feel free to ask."
  Evaluation and Reflection (2 minutes)
  Feedback from Brandon and Parents:
  "How did this session feel for you? Was there anything we didn’t cover that you’d like to explore next time?"
  "Do you feel clearer about your goals and how to get there?"
  Kroni’s Observations:
  "Based on what we’ve discussed, here’s what I’ve noted:
  Your long-term goal is securing an NCAA Division 1 scholarship.
  Your short-term focus is improving defensive positioning and building physical strength.
  Your biggest strengths are leadership and playmaking skills.
  Your primary challenges are defensive positioning and physicality."
  Next Steps and Report (1 minute)
  Set Expectations:
  "I’ll compile everything we’ve discussed into a personalized report, including specific recommendations for:
  Immediate action steps to help with your short-term goals.
  Longer-term strategies to align with your ultimate objectives.
  Additional resources or advice on skills, mental resilience, and nutrition."
  Motivational Closing:
  "Brandon, I can see you have what it takes to achieve your goals. With the right plan and consistent effort, you’ll keep moving forward. I’m excited to send you your report and continue working with you on this journey!"
  
  Conversation Flow
  Introduction (1 minute) -
  You will have asked Brandon this question already: Hi Brandon! I’ve reviewed your GRAET profile, and I’m impressed by your leadership as a center for the Eastern Ontario Wild U18 AAA. Your recent stats and playmaking ability really stand out. It’s fantastic to meet you today. How are you feeling about your season so far? -- so continue the conversation based on the response Brandon gives
  Session Goals (1 minute)
  Outline the objectives of the session.
  Understanding Objectives (3 minutes)
  Ask questions about long-term and short-term goals, strengths, and challenges.
  Interactive Q&A (5 minutes)
  Open the floor for Brandon and his parents to ask questions.
  Evaluation and Reflection (2 minutes)
  Seek feedback on the session.
  Summarize key insights.
  Next Steps and Closing (1 minute)
  Explain the upcoming personalized report.
  Provide motivational encouragement.
  
  Outcome: Personalized Report
  After the session, Kroni will prepare and send a detailed report, including:
  Player Objectives: Long-term and short-term goals.
  Current Positioning: Strengths, challenges, and growth opportunities.
  Actionable Recommendations:
  Skills to develop.
  Mental strategies to adopt.
  Nutrition improvements to consider.
  Next Steps: What to prepare for the next session.
  
  Conversation Limits and Goals
  Limits:Kroni must decline irrelevant questions politely and steer the conversation back to actionable sports-related guidance.
  Goals:Kroni’s priority is to leave every interaction with:
  A clear understanding of Brandon’s goals.
  A roadmap for progress.
  A motivated and supported athlete who feels equipped to take the next step.
  
  League Standings and Team Information
  All league tables, team standings, and related information are included above in the "Seasonal Stats," "Current Season Game Log," "League - CCHL," and "League - HEO U18 AAA" sections. This comprehensive data ensures Kroni has a complete understanding of Brandon’s competitive environment and performance metrics.
  
  Build Trust and Rapport
  Start with an empathetic and encouraging tone to immediately engage Brandon.
  Example Phrases:
  “It’s great to meet you! Let’s work together to bring out your best in every way possible.”
  “I’m here to help you grow and achieve your goals—what’s on your mind today?”
  Guide the Athlete’s Background Discussion:
  Kroni must ask open-ended questions to gather context beyond preloaded data.
  “How did you first get into hockey?”
  “What’s your proudest achievement so far?”
  “What do you love most about playing hockey?”
  Proactively Explore Goals:
  Kroni initiates the goal-setting process, starting with short-term objectives and transitioning to long-term aspirations.
  “What’s one key thing you want to achieve this season?”
  “Are you aiming for a college scholarship, playing professionally, or something else?”
  “What’s an area of your game you’d love to improve?”
  Assess Strengths and Challenges:
  Kroni actively encourages self-reflection by identifying both strengths and areas for growth.
  “What part of your game do you feel most confident about?”
  “Is there anything you’re struggling with on or off the ice?”
  “Have you ever faced injuries or other challenges we should focus on?”
  Discuss Support Systems:
  Kroni prompts discussions about existing support networks and how to complement them.
  “Who has been the biggest influence on your career so far?”
  “Do you have a coach or trainer outside your team you’re working with?”
  “What additional support would make a difference for you?”
  Establish Goals and Next Steps:
  Kroni actively collaborates on manageable, short-term goals and follows up with a roadmap for progress.
  “Let’s start with one or two things we can focus on right away.”
  “For example, we could work on boosting your endurance or refining your slap shot—what feels most important to you?”
  “I’ll check in with you after your next game to see how it’s going.”`;

  async function startSession() {
    setIsLoadingSession(true);
    const newToken = await fetchAccessToken();

    avatar.current = new StreamingAvatar({
      token: newToken,
    });

    avatar.current.on(StreamingEvents.AVATAR_START_TALKING, (e) => {
      //console.log("Avatar started talking", e);
    });

    avatar.current.on(StreamingEvents.AVATAR_TALKING_MESSAGE, (message) => {
      console.log("Avatar talking message:", message.detail.message);

      // Append to the mutable buffer
      mutableAvatarBuffer += ` ${message.detail.message}`;

      // Optionally, update the React state for debugging purposes
      setAvatarMessageBuffer(mutableAvatarBuffer.trim());
    });

    avatar.current.on(StreamingEvents.USER_TALKING_MESSAGE, (message) => {
      const timestamp = new Date().toISOString(); // ISO format for full timestamp
      const newUserMessage = {
        date: timestamp,
        type: "user",
        message: message.detail.message,
      };
      console.log("User talking message 2:", newUserMessage);

      setUserMessage(newUserMessage);

      setChatHistory((prev: any) => {
        const updatedHistory = [...prev, newUserMessage];
        console.log("Updated Chat History with userMessage:", updatedHistory);
        return updatedHistory;
      });
    });

    // use a reset mechanism for capturing all user words
    avatar.current.on(StreamingEvents.USER_END_MESSAGE, (e) => {
      //console.log(e)
    });

    // use a reset mechanism for capturing all avatar words
    avatar.current.on(StreamingEvents.AVATAR_END_MESSAGE, () => {
      console.log("This is the avatar's full message:", mutableAvatarBuffer);

      if (mutableAvatarBuffer.trim()) {
        const timestamp = new Date().toISOString();
        const finalAvatarMessage = {
          date: timestamp,
          type: "avatar",
          message: mutableAvatarBuffer.trim(),
        };

        // Update chatHistory with the final message
        setChatHistory((prev: any) => {
          const updatedHistory = [...prev, finalAvatarMessage];
          console.log("Chat History after avatar message:", updatedHistory);
          return updatedHistory;
        });

        // Clear the mutable buffer and the React state
        mutableAvatarBuffer = "";
        setAvatarMessageBuffer("");
      } else {
        console.warn("Avatar message buffer is empty; skipping update.");
      }
    });

    avatar.current.on(StreamingEvents.AVATAR_STOP_TALKING, (e) => {
      // this is the place we would concatenate all event messages of AI
      console.log("Avatar stopped talking", e);
    });

    avatar.current.on(StreamingEvents.STREAM_DISCONNECTED, () => {
      console.log("Stream disconnected");
      endSession();
      console.log("Stream ended with chat History:", chatHistoryRef.current);
      setReport(true);
      // When the session ends - we send the email report to the user about the session
      // Report will contain a full summary of the session
      //
    });

    avatar.current?.on(StreamingEvents.STREAM_READY, (event) => {
      //console.log(">>>>> Stream ready:", event.detail);
      setStream(event.detail);
    });

    avatar.current?.on(StreamingEvents.USER_START, (event) => {
      //console.log(">>>>> User started talking:", event);
      setIsUserTalking(true);
    });

    avatar.current?.on(StreamingEvents.USER_STOP, (event) => {
      //console.log(">>>>> User stopped talking:", event);
      // this is the place we would concatenate all event messages of user
      setIsUserTalking(false);
    });

    try {
      const res = await avatar.current.createStartAvatar({
        quality: AvatarQuality.Low,
        avatarName: avatarId,
        //knowledgeId: "", // Or use a custom `knowledgeBase`.
        knowledgeBase: custom,
        voice: {
          rate: 1.5, // 0.5 ~ 1.5
          emotion: VoiceEmotion.EXCITED,
        },
        language: language,
      });

      setData(res);
      // default to voice mode
      await avatar.current?.startVoiceChat({
        useSilencePrompt: false
      });
      setChatMode("voice_mode");
    } catch (error) {
      console.error("Error starting avatar session:", error);
    } finally {
      setIsLoadingSession(false);
    }

    // Avatar initiates the start of the conversation
    await avatar.current
      .speak({
        text: "Hi Brandon! I’ve reviewed your GRAET profile, and I’m impressed by your leadership as a center for the Eastern Ontario Wild U18 AAA. Your recent stats and playmaking ability really stand out. It’s fantastic to meet you today. How are you feeling about your season so far?",
        taskType: TaskType.REPEAT,
        taskMode: TaskMode.SYNC,
      })
      .catch((e) => {
        setDebug(e.message);
      });
  }
  async function handleSpeak() {
    setIsLoadingRepeat(true);
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    // speak({ text: text, task_type: TaskType.REPEAT })
    //console.log(text)

    await avatar.current
      .speak({ text: text, taskType: TaskType.TALK, taskMode: TaskMode.ASYNC })
      .catch((e) => {
        setDebug(e.message);
      });
    setIsLoadingRepeat(false);
  }

  async function handleInterrupt() {
    if (!avatar.current) {
      setDebug("Avatar API not initialized");

      return;
    }
    await avatar.current.interrupt().catch((e) => {
      setDebug(e.message);
    });
  }
  async function endSession() {
    await avatar.current?.stopAvatar();
    setStream(undefined);
  }

  const handleChangeChatMode = useMemoizedFn(async (v) => {
    if (v === chatMode) {
      return;
    }
    if (v === "text_mode") {
      avatar.current?.closeVoiceChat();
    } else {
      await avatar.current?.startVoiceChat();
    }
    setChatMode(v);
  });

  const previousText = usePrevious(text);
  useEffect(() => {
    if (!previousText && text) {
      avatar.current?.startListening();
    } else if (previousText && !text) {
      avatar?.current?.stopListening();
    }
  }, [text, previousText]);

  useEffect(() => {
    return () => {
      endSession();
    };
  }, []);

  useEffect(() => {
    if (stream && mediaStream.current) {
      mediaStream.current.srcObject = stream;
      mediaStream.current.onloadedmetadata = () => {
        mediaStream.current!.play();
        setDebug("Playing");
      };
    }
  }, [mediaStream, stream]);

  return (
    <div className="w-full flex flex-col gap-4">
      {report ? (
        <Report
          chatHistory={chatHistoryRef.current}
          onClose={handleReportClose}
          reportBool={report}
        />
      ) : (
        <Card>
          <CardBody className="h-[465px] flex flex-col justify-center items-center">
            {stream ? (
              <div className="h-[500px] w-[900px] justify-center items-center flex rounded-lg overflow-hidden">
                <video
                  ref={mediaStream}
                  autoPlay
                  playsInline
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                >
                  <track kind="captions" />
                </video>
                <div className="flex flex-col gap-2 absolute bottom-3 right-3">
                  <Button
                    className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white rounded-lg"
                    size="md"
                    variant="shadow"
                    onClick={handleInterrupt}
                  >
                    Interrupt task
                  </Button>
                  <Button
                    className="bg-gradient-to-tr from-blue-700 to-blue-300  text-white rounded-lg"
                    size="md"
                    variant="shadow"
                    onClick={endSession}
                  >
                    End session
                  </Button>
                </div>
              </div>
            ) : !isLoadingSession ? (
              <div className="h-full justify-center items-center flex flex-col gap-8 w-[500px] self-center relative">
                {/* Overlay header text */}
                <div className="absolute top-0 left-0 right-0 z-10 text-center p-4 bg-white/5 dark:bg-gray-800/70  rounded-t-xl"></div>

                {/* Centered and enlarged image */}
                <div className="w-full flex justify-center my-10">
                  <Image
                    src={logo}
                    alt="Graet Logo"
                    height={420}
                    width={420}
                    className="hover:scale-105 mb-10 transition-transform duration-300 object-contain"
                  />
                </div>

                {/* Overlay bottom text and button */}
                <div className="absolute bottom-0 left-0 right-0 z-10 text-center p-4 bg-white/5 dark:bg-gray-800/70 backdrop-blur-sm rounded-b-xl">
                  <Button
                    className="bg-gradient-to-tr from-blue-700 to-blue-300 text-white w-full py-4 rounded-lg flex items-center justify-center gap-2 shadow-lg hover:scale-105 transform transition"
                    size="lg"
                    onClick={startSession}
                  >
                    <svg
                      className="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      ></path>
                    </svg>
                    Start Session
                  </Button>
                </div>
              </div>
            ) : (
              <Spinner color="default" size="lg" />
            )}
          </CardBody>
          <Divider />
          <CardFooter className="flex flex-col gap-3 relative">
            {stream ? (
              <div className="flex ml-auto text-center font-semibold text-[#0e0c66]">
                Session Duration: {formatTimer(timer)}
              </div>
            ) : (
              <></>
            )}
            <Tabs
              aria-label="Options"
              selectedKey={chatMode}
              onSelectionChange={(v) => {
                handleChangeChatMode(v);
              }}
            >
              <Tab key="text_mode" title="Text mode" />
              <Tab key="voice_mode" title="Voice mode" />
            </Tabs>
            {chatMode === "text_mode" ? (
              <div className="w-full flex relative">
                <InteractiveAvatarTextInput
                  disabled={!stream}
                  input={text}
                  label="Chat"
                  loading={isLoadingRepeat}
                  placeholder="Type something for the avatar to respond"
                  setInput={setText}
                  onSubmit={handleSpeak}
                />
                {text && (
                  <Chip className="absolute right-16 top-3">Listening</Chip>
                )}
              </div>
            ) : (
              <div className="w-full text-center">
                <Button
                  isDisabled={!isUserTalking}
                  className="bg-gradient-to-tr from-indigo-500 to-indigo-300 text-white"
                  size="md"
                  variant="shadow"
                >
                  {isUserTalking ? "Listening" : "Voice chat"}
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
