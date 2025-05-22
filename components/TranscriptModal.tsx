// components/TranscriptModal.tsx
'use client';

import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from "@nextui-org/react";
import { AppTranscriptMessage } from './Elevenlabs2'; // Assuming IntroductoryChat exports this
import { X } from 'lucide-react';

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: AppTranscriptMessage[] | undefined;
  roleTitle: string;
}

const GRAET_BLUE = '#0e0c66';

export const TranscriptModal: React.FC<TranscriptModalProps> = ({ isOpen, onClose, transcript, roleTitle }) => {
  if (!transcript) {
    return null;
  }

  const formatDate = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onOpenChange={(open) => !open && onClose()} // Call onClose when modal is closed by backdrop click or ESC
      size="2xl" // Or "xl", "lg", "md", "sm", "xs", "full"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        {(modalOnClose) => ( // modalOnClose is provided by NextUI Modal for its internal close button
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-xl font-semibold text-gray-800">
                  Chat Transcript: {roleTitle}
                </span>
                
              </div>
            </ModalHeader>
            <ModalBody className="py-6 px-4 md:px-6">
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {transcript.map((msg, index) => (
                  <div key={index} className={`flex flex-col ${
                    msg.speaker === 'user' ? 'items-end' : 
                    msg.speaker === 'ai' ? 'items-start' : 
                    'items-center' // system_event
                  }`}>
                    <div className={`max-w-[75%] p-3 rounded-xl shadow-sm ${
                      msg.speaker === 'user' ? `bg-[${GRAET_BLUE}] text-white rounded-br-none` :
                      msg.speaker === 'ai' ? 'bg-gray-100 text-gray-800 rounded-bl-none' :
                      'bg-yellow-100 text-yellow-700 text-xs italic w-full text-center py-2'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                    </div>
                    <span className={`text-xs mt-1 ${
                        msg.speaker === 'system_event' ? 'text-yellow-600' : 'text-gray-400'
                    }`}>
                      {msg.speaker !== 'system_event' && (
                        <span className="font-medium capitalize">
                          {msg.speaker === 'ai' ? 'Blue' : msg.speaker}:{' '}
                        </span>
                      )}
                      {formatDate(msg.timestamp)}
                    </span>
                  </div>
                ))}
                {transcript.length === 0 && (
                  <p className="text-center text-gray-500">No messages in this transcript.</p>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="border-t border-gray-200">
              <Button 
                color="danger" 
                variant="light" 
                onPress={modalOnClose} // Use NextUI's provided close handler
              >
                Close
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};