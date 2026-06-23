import React, { useState } from 'react';
import { Recipient, EmailTemplate, SentStatus } from '../types';
import { Mail, CheckCircle2, ChevronDown, ChevronUp, Copy, ExternalLink, Sparkles, Loader2, Send } from 'lucide-react';

interface EmailPreviewListProps {
  recipients: Recipient[];
  template: EmailTemplate;
  sentStatus: SentStatus;
  markAsSent: (id: string) => void;
  updateRecipient: (id: string, updates: Partial<Recipient>) => void;
  smtpConfig: { smtpHost: string; smtpPort: string; smtpUser: string; smtpPass: string; fromAddress: string; ccAddress: string; bccMyself: boolean };
}

export function EmailPreviewList({ recipients, template, sentStatus, markAsSent, updateRecipient, smtpConfig }: EmailPreviewListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  const getReplacedText = (text: string, recipient: Recipient) => {
    let result = text;
    
    if (!recipient['Personalized_Line']) {
      result = result.replace(/\n*{{Personalized_Line}}\n*/gi, '\n\n');
    } else {
      result = result.replace(/{{Personalized_Line}}/gi, recipient['Personalized_Line']);
    }

    Object.keys(recipient).forEach(key => {
      if (key === 'id' || key === 'Personalized_Line') return;
      const regex = new RegExp(`{{${key}}}`, 'gi');
      result = result.replace(regex, recipient[key] || '');
    });
    
    return result;
  };

  const getRecipientEmail = (recipient: Recipient): string => {
    const emailKey = Object.keys(recipient).find(key => key.toLowerCase().includes('email'));
    return emailKey ? recipient[emailKey] : '';
  };

  const handleGenerateAI = async (recipient: Recipient, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const interestKey = Object.keys(recipient).find(k => 
      k.toLowerCase().includes('research') || 
      k.toLowerCase().includes('interest') ||
      k.toLowerCase().includes('area')
    );

    const nameKey = Object.keys(recipient).find(k => k.toLowerCase().includes('name'));
    const profName = nameKey ? recipient[nameKey] : '';
    const researchInterest = interestKey ? recipient[interestKey] : '';

    if (!researchInterest) {
      alert("Could not find a research interest column (e.g., 'Research Interest'). Please ensure your CSV has one.");
      return;
    }

    setGeneratingFor(recipient.id);
    try {
      const response = await fetch('/api/generate-personalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researchInterest, profName })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate');
      
      updateRecipient(recipient.id, { Personalized_Line: data.text });
      setExpandedId(recipient.id);
    } catch (err: any) {
      alert(`Error generating text: ${err.message}`);
    } finally {
      setGeneratingFor(null);
    }
  };

  const handleGenerateAllMissingAI = async () => {
    setIsGeneratingAll(true);
    let errorCount = 0;
    
    for (const recipient of recipients) {
      if (sentStatus[recipient.id] || recipient['Personalized_Line']) continue;
      
      const interestKey = Object.keys(recipient).find(k => 
        k.toLowerCase().includes('research') || 
        k.toLowerCase().includes('interest') ||
        k.toLowerCase().includes('area')
      );
      const nameKey = Object.keys(recipient).find(k => k.toLowerCase().includes('name'));
      const profName = nameKey ? recipient[nameKey] : '';
      const researchInterest = interestKey ? recipient[interestKey] : '';

      if (!researchInterest) continue;

      setGeneratingFor(recipient.id);
      try {
        const response = await fetch('/api/generate-personalization', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ researchInterest, profName })
        });
        
        const data = await response.json();
        if (response.ok) {
          updateRecipient(recipient.id, { Personalized_Line: data.text });
        } else {
          errorCount++;
        }
      } catch (err) {
        errorCount++;
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setGeneratingFor(null);
    setIsGeneratingAll(false);
    if (errorCount > 0) {
      alert(`Finished, but encountered errors on ${errorCount} rows.`);
    }
  };

  const handleSendDirectly = async (recipient: Recipient, subject: string, body: string) => {
    const email = getRecipientEmail(recipient);
    if (!email) {
      alert("Could not find an email address for this recipient.");
      return;
    }
    
    if (!smtpConfig.smtpUser || !smtpConfig.smtpPass || !smtpConfig.fromAddress) {
      alert("Please fill in all SMTP Configuration fields first.");
      return;
    }

    setSendingId(recipient.id);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: smtpConfig.smtpHost,
          smtpPort: smtpConfig.smtpPort,
          smtpUser: smtpConfig.smtpUser,
          smtpPass: smtpConfig.smtpPass,
          fromAddress: smtpConfig.fromAddress,
          ccAddress: smtpConfig.ccAddress,
          bccMyself: smtpConfig.bccMyself,
          to: email,
          subject,
          body
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send');
      
      markAsSent(recipient.id);
    } catch (err: any) {
      alert(`Error sending email: ${err.message}`);
    } finally {
      setSendingId(null);
    }
  };

  if (recipients.length === 0) {
    return (
      <div className="bg-white rounded shadow-sm border border-gray-200 p-8 text-center text-gray-500 text-sm">
        Upload a CSV file to see email previews here.
      </div>
    );
  }

  const sentCount = Object.values(sentStatus).filter(Boolean).length;
  const unsentRecipients = recipients.filter(r => !sentStatus[r.id]);
  const nextUnsent = unsentRecipients[0];
  const missingAiCount = unsentRecipients.filter(r => !r['Personalized_Line'] && Object.keys(r).some(k => k.toLowerCase().includes('interest') || k.toLowerCase().includes('research') || k.toLowerCase().includes('area'))).length;

  const handleFastSend = async () => {
    if (!nextUnsent) return;
    const subject = nextUnsent['_editedSubject'] ?? getReplacedText(template.subject, nextUnsent);
    const body = nextUnsent['_editedBody'] ?? getReplacedText(template.body, nextUnsent);
    await handleSendDirectly(nextUnsent, subject, body);
  };

  return (
    <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base font-semibold text-gray-800">Email Previews</h2>
            <p className="text-xs text-gray-500 mt-1">Review and send your emails directly</p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-medium border border-blue-100">
            Sent: {sentCount} / {recipients.length}
          </div>
        </div>

        {missingAiCount > 0 && template.body.includes('{{Personalized_Line}}') && (
          <div className="flex items-center justify-between bg-purple-50 p-3 rounded border border-purple-100">
            <div>
              <h3 className="font-medium text-purple-900 flex items-center text-sm">
                <Sparkles size={14} className="mr-2 text-purple-600" />
                Missing Personalized Lines
              </h3>
              <p className="text-xs text-purple-700 mt-0.5">
                {missingAiCount} unsent emails are missing their AI-generated line.
              </p>
            </div>
            <button
              onClick={handleGenerateAllMissingAI}
              disabled={isGeneratingAll}
              className="flex items-center px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm whitespace-nowrap"
            >
              {isGeneratingAll ? (
                <><Loader2 size={14} className="mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles size={14} className="mr-2" /> Generate All</>
              )}
            </button>
          </div>
        )}

        {nextUnsent ? (
          <div className="flex items-center justify-between bg-blue-50/50 p-3 rounded border border-blue-100/50">
            <div>
              <h3 className="font-medium text-gray-900 flex items-center text-sm">
                Fast Send Mode
              </h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Next: <span className="font-semibold">{Object.keys(nextUnsent).find(k => k.toLowerCase().includes('name')) ? nextUnsent[Object.keys(nextUnsent).find(k => k.toLowerCase().includes('name'))!] : getRecipientEmail(nextUnsent)}</span>
              </p>
            </div>
            <button
              onClick={handleFastSend}
              disabled={sendingId === nextUnsent.id}
              className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap disabled:opacity-50"
            >
              {sendingId === nextUnsent.id ? (
                <><Loader2 size={16} className="mr-2 animate-spin" /> Sending...</>
              ) : (
                <><Send size={16} className="mr-2" /> Send & Next</>
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center bg-green-50 p-3 rounded border border-green-100">
            <CheckCircle2 size={16} className="text-green-600 mr-2" />
            <span className="font-medium text-green-800 text-sm">All emails sent!</span>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-100">
        {recipients.map((recipient, index) => {
          const isExpanded = expandedId === recipient.id;
          const isSent = sentStatus[recipient.id];
          const subject = getReplacedText(template.subject, recipient);
          const body = getReplacedText(template.body, recipient);
          const email = getRecipientEmail(recipient);
          const displayName = Object.keys(recipient).find(k => k.toLowerCase().includes('name')) 
            ? recipient[Object.keys(recipient).find(k => k.toLowerCase().includes('name'))!] 
            : email;

          return (
            <div key={recipient.id} className={`transition-colors ${isSent ? 'bg-green-50/30' : 'hover:bg-gray-50/50'}`}>
              <div 
                className="p-4 flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : recipient.id)}
              >
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isSent ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                    {isSent ? <CheckCircle2 size={18} /> : <span className="text-xs font-medium">{index + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900 truncate">{displayName}</span>
                      <span className="text-sm text-gray-500 truncate">&lt;{email}&gt;</span>
                    </div>
                    <div className="text-sm text-gray-600 truncate mt-0.5">{subject || '(No subject)'}</div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3 ml-4 shrink-0">
                  <button 
                    onClick={(e) => handleGenerateAI(recipient, e)}
                    disabled={generatingFor === recipient.id}
                    className="flex items-center text-xs font-medium px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md transition-colors border border-purple-200 disabled:opacity-50"
                    title="Generate Personalized Line based on Research Interest"
                  >
                    {generatingFor === recipient.id ? (
                      <Loader2 size={14} className="mr-1 animate-spin" />
                    ) : (
                      <Sparkles size={14} className="mr-1" />
                    )}
                    Generate AI Line
                  </button>
                  {isSent && <span className="text-xs font-medium text-green-600 px-2 py-1 bg-green-100 rounded-full">Sent</span>}
                  <button className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100">
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/30">
                  <div className="mb-4 bg-white rounded border border-gray-200 p-4 shadow-sm">
                    <div className="mb-3 pb-3 border-b border-gray-100 flex justify-between items-start">
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-500 mb-1">To: <span className="text-gray-900">{email}</span></div>
                        {editingId === recipient.id ? (
                          <div className="flex items-center space-x-2 mt-2">
                            <span className="text-sm font-medium text-gray-500 whitespace-nowrap">Subject:</span>
                            <input
                              type="text"
                              value={editSubject}
                              onChange={(e) => setEditSubject(e.target.value)}
                              className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm outline-none focus:border-blue-500"
                            />
                          </div>
                        ) : (
                          <div className="text-sm font-medium text-gray-500">Subject: <span className="text-gray-900">{subject}</span></div>
                        )}
                      </div>
                      {editingId === recipient.id ? (
                        <div className="flex space-x-2 ml-4 shrink-0 mt-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingId(null);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              updateRecipient(recipient.id, { _editedSubject: editSubject, _editedBody: editBody });
                              setEditingId(null);
                            }}
                            className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded font-medium"
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(recipient.id);
                            setEditSubject(subject);
                            setEditBody(body);
                          }}
                          className="text-xs text-gray-500 hover:text-blue-600 font-medium ml-4 shrink-0 mt-1"
                        >
                          Edit Email
                        </button>
                      )}
                    </div>
                    {editingId === recipient.id ? (
                      <textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={10}
                        className="w-full text-sm text-gray-800 p-2 border border-gray-300 rounded outline-none focus:border-blue-500 font-sans"
                      />
                    ) : (
                      <div 
                        className="text-sm text-gray-800 font-sans email-body-preview prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br/>') }}
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-end space-x-3 mt-4">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(body);
                      }}
                      className="flex items-center px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded hover:bg-gray-50 shadow-sm"
                    >
                      <Copy size={14} className="mr-2" />
                      Copy Body
                    </button>
                    <button 
                      onClick={async (e) => {
                        e.stopPropagation();
                        await handleSendDirectly(recipient, subject, body);
                      }}
                      disabled={sendingId === recipient.id}
                      className="flex items-center px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 shadow-sm disabled:opacity-50"
                    >
                      {sendingId === recipient.id ? (
                        <><Loader2 size={14} className="mr-2 animate-spin" /> Sending...</>
                      ) : (
                        <><Send size={14} className="mr-2" /> {isSent ? 'Send Again' : 'Send Now'}</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
