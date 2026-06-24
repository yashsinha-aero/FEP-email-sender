
import React, { useState } from 'react';
import { CsvUploader } from './components/CsvUploader';
import { TemplateEditor } from './components/TemplateEditor';
import { EmailPreviewList } from './components/EmailPreviewList';
import { Recipient, EmailTemplate, SentStatus } from './types';
import { Send, FileSpreadsheet, Settings } from 'lucide-react';
import { formatProfName } from './utils/nameHelper';

const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: 'Invitation to Participate in the Foreign Exposure Programme (FEP) – IIT Kanpur',
  body: `Dear {{Prof Name}},

Greetings from the International Relations Wing, IIT Kanpur!

We are excited to continue the Foreign Exposure Programme (FEP), organised by the IR Wing to foster international collaboration and provide students with valuable research experience. We are seeking research projects--either remote or on-site--under your guidance, with or without a stipend from your side.

{{Personalized_Line}}

You can find more details about the programme in our brochure&nbsp;<a href="https://drive.google.com/file/d/1LhUNhBEgSJ-c8KgDvOMXV6xgmO-UKk4k/view" target="_blank" rel="noopener noreferrer" style="display: inline !important; white-space: nowrap;">here</a>.

The applicants for this programme are highly motivated undergraduate students from one of India's premier institutes, eager to gain research experience and explore their interests in various fields. They are enthusiastic, dependable, and committed to utilising their skills effectively.

We kindly request you to register in our portal&nbsp;<a href="https://iriitk.com/fep/signup" target="_blank" rel="noopener noreferrer" style="display: inline !important; white-space: nowrap;">here</a>&nbsp;and add the project details.

In case of any issues with the portal please fill the Google form&nbsp;<a href="https://docs.google.com/forms/d/e/1FAIpQLSdVCuneIq-zdJRRDeSdQfZE_2w4arievRUCAL6nmBBdmpxGww/viewform?usp=send_form" target="_blank" rel="noopener noreferrer" style="display: inline !important; white-space: nowrap;">here</a>.

Once you submit the form, a member of our team will reach out to you for further discussions.

If you have any questions, please feel free to reply to this email.

Looking forward to your participation.

Best regards,
Yash Sinha
Secretary
International Relations Wing, IIT Kanpur`
};

export default function App() {
  const [recipients, setRecipients] = useState<Recipient[]>(() => {
    const saved = localStorage.getItem('profmail_recipients');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Recipient[];
        if (parsed.length > 0) {
          const keys = Object.keys(parsed[0]);
          const nameKey = keys.find(k => k.toLowerCase().includes('prof name')) ||
            keys.find(k => k.toLowerCase().includes('name') && !k.toLowerCase().includes('email') && !k.toLowerCase().includes('cc') && !k.toLowerCase().includes('bcc'));
          if (nameKey) {
            return parsed.map(r => ({
              ...r,
              [nameKey]: formatProfName(r[nameKey] || '')
            }));
          }
        }
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });
  const [headers, setHeaders] = useState<string[]>(() => {
    const saved = localStorage.getItem('profmail_headers');
    return saved ? JSON.parse(saved) : [];
  });
  const [template, setTemplate] = useState<EmailTemplate>(() => {
    const saved = localStorage.getItem('profmail_template');
    if (saved) return JSON.parse(saved);
    return DEFAULT_TEMPLATE;
  });
  const [ccAddress, setCcAddress] = useState<string>(() => localStorage.getItem('profmail_ccAddress') ?? 'sumitd24@iitk.ac.in');
  const [manualSend, setManualSend] = useState<boolean>(() => {
    const saved = localStorage.getItem('profmail_manualSend');
    return saved ? saved === 'true' : false;
  });
  const [sentStatus, setSentStatus] = useState<SentStatus>(() => {
    const saved = localStorage.getItem('profmail_sentStatus');
    return saved ? JSON.parse(saved) : {};
  });

  React.useEffect(() => {
    localStorage.setItem('profmail_recipients', JSON.stringify(recipients));
  }, [recipients]);

  React.useEffect(() => {
    localStorage.setItem('profmail_headers', JSON.stringify(headers));
  }, [headers]);

  React.useEffect(() => {
    localStorage.setItem('profmail_template', JSON.stringify(template));
  }, [template]);

  React.useEffect(() => {
    localStorage.setItem('profmail_ccAddress', ccAddress);
  }, [ccAddress]);

  React.useEffect(() => {
    localStorage.setItem('profmail_manualSend', String(manualSend));
  }, [manualSend]);

  React.useEffect(() => {
    localStorage.setItem('profmail_sentStatus', JSON.stringify(sentStatus));
  }, [sentStatus]);

  const handleDataLoaded = (data: Recipient[], loadedHeaders: string[]) => {
    setRecipients(data);
    if (!loadedHeaders.includes('Personalized_Line')) {
      setHeaders([...loadedHeaders, 'Personalized_Line']);
    } else {
      setHeaders(loadedHeaders);
    }
  };

  const handleUpdateRecipient = (id: string, updates: Partial<Recipient>) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const handleMarkAsSent = (id: string) => {
    setSentStatus(prev => ({ ...prev, [id]: true }));
  };

  const handleReset = () => {
    if (confirm('Reset all configurations, templates, and data to defaults?')) {
      localStorage.removeItem('profmail_recipients');
      localStorage.removeItem('profmail_headers');
      localStorage.removeItem('profmail_template');
      localStorage.removeItem('profmail_ccAddress');
      localStorage.removeItem('profmail_manualSend');
      localStorage.removeItem('profmail_sentStatus');

      setRecipients([]);
      setHeaders([]);
      setTemplate(DEFAULT_TEMPLATE);
      setCcAddress('sumitd24@iitk.ac.in');
      setManualSend(false);
      setSentStatus({});
    }
  };

  const [nwmConnecting, setNwmConnecting] = useState(false);
  const [nwmStatus, setNwmStatus] = useState<'disconnected' | 'waiting_for_login' | 'connected'>('disconnected');

  React.useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/nwm-status');
        const data = await res.json();
        if (data.status) setNwmStatus(data.status);
      } catch (e) {
        setNwmStatus('disconnected');
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectNwm = async () => {
    setNwmConnecting(true);
    try {
      const res = await fetch('/api/start-nwm', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e: any) {
      alert("Failed to start NWM: " + e.message);
    } finally {
      setNwmConnecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <h1 className="text-xl font-medium tracking-tight text-gray-900">ProfMail Sender</h1>
          <button
            onClick={handleReset}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            Reset to Default
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">

          <div className="space-y-8">
            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">1. Configuration</h2>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-800 mb-3 font-medium">Connect via NWM Webmail</p>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleConnectNwm}
                      disabled={nwmConnecting || nwmStatus === 'connected'}
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {nwmConnecting ? 'Connecting...' : (nwmStatus === 'connected' ? 'NWM Active' : 'Connect via NWM Webmail')}
                    </button>
                    {nwmStatus === 'waiting_for_login' && <span className="text-xs font-semibold text-orange-600 animate-pulse">Waiting for you to log in...</span>}
                    {nwmStatus === 'connected' && <span className="text-xs font-bold text-green-600">✓ Connected & Ready to Send</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">CC Address (Optional)</label>
                  <input
                    type="text"
                    value={ccAddress}
                    onChange={(e) => setCcAddress(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                    placeholder="sumitd24@iitk.ac.in"
                  />
                </div>
                <div className="pt-2 space-y-3">
                  <div className="space-y-1">
                    <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer font-medium text-blue-700">
                      <input
                        type="checkbox"
                        checked={manualSend}
                        onChange={(e) => setManualSend(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                      />
                      <span>Review & Send manually in browser</span>
                    </label>
                    <p className="text-[11px] text-gray-500 ml-6 leading-normal">
                      If checked, NWM will compose the email and paste the content but won't click "Send" automatically. You can review/edit it, click "Send" yourself, and the next recipient will automatically load.
                    </p>
                  </div>
                </div>
              </div>
            </section>
 
            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">2. CSV Upload</h2>
              <CsvUploader onDataLoaded={handleDataLoaded} />
            </section>
 
            <section>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">3. Template</h2>
              <TemplateEditor
                template={template}
                setTemplate={setTemplate}
                availableVariables={headers}
              />
            </section>
          </div>
 
          <div>
            <section className="sticky top-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">4. Review & Send</h2>
              <EmailPreviewList
                recipients={recipients}
                template={template}
                sentStatus={sentStatus}
                markAsSent={handleMarkAsSent}
                updateRecipient={handleUpdateRecipient}
                smtpConfig={{ ccAddress, manualSend }}
                isNwmActive={nwmStatus === 'connected'}
              />
            </section>
          </div>
        </div>

        <footer className="pt-12 pb-4 text-center text-[11px] text-gray-400 font-normal tracking-wider select-none">
          Developed by Yash Sinha
        </footer>
      </div>
    </div>
  );
}
