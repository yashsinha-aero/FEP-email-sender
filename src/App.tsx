
import React, { useState } from 'react';
import { CsvUploader } from './components/CsvUploader';
import { TemplateEditor } from './components/TemplateEditor';
import { EmailPreviewList } from './components/EmailPreviewList';
import { Recipient, EmailTemplate, SentStatus } from './types';
import { Send, FileSpreadsheet, Settings } from 'lucide-react';

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
International Relations Wing`
};

export default function App() {
  const [recipients, setRecipients] = useState<Recipient[]>(() => {
    const saved = localStorage.getItem('profmail_recipients');
    return saved ? JSON.parse(saved) : [];
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
  const [smtpHost, setSmtpHost] = useState<string>(() => localStorage.getItem('profmail_smtpHost') ?? 'mmtp.iitk.ac.in');
  const [smtpPort, setSmtpPort] = useState<string>(() => localStorage.getItem('profmail_smtpPort') ?? '465');
  const [smtpUser, setSmtpUser] = useState<string>(() => localStorage.getItem('profmail_smtpUser') ?? '');
  const [smtpPass, setSmtpPass] = useState<string>(() => localStorage.getItem('profmail_smtpPass') ?? '');
  const [fromAddress, setFromAddress] = useState<string>(() => localStorage.getItem('profmail_fromAddress') ?? '');
  const [ccAddress, setCcAddress] = useState<string>(() => localStorage.getItem('profmail_ccAddress') ?? 'sumitd24@iitk.ac.in');
  const [bccMyself, setBccMyself] = useState<boolean>(() => {
    const saved = localStorage.getItem('profmail_bccMyself');
    return saved ? saved === 'true' : true;
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
    localStorage.setItem('profmail_smtpHost', smtpHost);
  }, [smtpHost]);

  React.useEffect(() => {
    localStorage.setItem('profmail_smtpPort', smtpPort);
  }, [smtpPort]);

  React.useEffect(() => {
    localStorage.setItem('profmail_smtpUser', smtpUser);
  }, [smtpUser]);

  React.useEffect(() => {
    localStorage.setItem('profmail_smtpPass', smtpPass);
  }, [smtpPass]);

  React.useEffect(() => {
    localStorage.setItem('profmail_fromAddress', fromAddress);
  }, [fromAddress]);

  React.useEffect(() => {
    localStorage.setItem('profmail_ccAddress', ccAddress);
  }, [ccAddress]);

  React.useEffect(() => {
    localStorage.setItem('profmail_bccMyself', String(bccMyself));
  }, [bccMyself]);

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
      localStorage.removeItem('profmail_smtpHost');
      localStorage.removeItem('profmail_smtpPort');
      localStorage.removeItem('profmail_smtpUser');
      localStorage.removeItem('profmail_smtpPass');
      localStorage.removeItem('profmail_fromAddress');
      localStorage.removeItem('profmail_ccAddress');
      localStorage.removeItem('profmail_bccMyself');
      localStorage.removeItem('profmail_sentStatus');

      setRecipients([]);
      setHeaders([]);
      setTemplate(DEFAULT_TEMPLATE);
      setSmtpHost('mmtp.iitk.ac.in');
      setSmtpPort('465');
      setSmtpUser('');
      setSmtpPass('');
      setFromAddress('');
      setCcAddress('sumitd24@iitk.ac.in');
      setBccMyself(true);
      setSentStatus({});
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">SMTP Host</label>
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Port</label>
                    <input
                      type="text"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Username / Email</label>
                    <input
                      type="text"
                      value={smtpUser}
                      onChange={(e) => setSmtpUser(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Password</label>
                    <input
                      type="password"
                      value={smtpPass}
                      onChange={(e) => setSmtpPass(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From Name & Address (e.g. Your Name &lt;your@iitk.ac.in&gt;)</label>
                  <input
                    type="text"
                    value={fromAddress}
                    onChange={(e) => setFromAddress(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none focus:border-gray-500"
                  />
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
                <div className="pt-2">
                  <label className="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={bccMyself}
                      onChange={(e) => setBccMyself(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                    />
                    <span>BCC myself (to save a copy)</span>
                  </label>
                  <p className="text-[11px] text-gray-500 mt-1 ml-6">
                    SMTP doesn't save to "Sent" folder automatically. BCC yourself to keep a record.
                  </p>
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
                smtpConfig={{ smtpHost, smtpPort, smtpUser, smtpPass, fromAddress, ccAddress, bccMyself }}
              />
            </section>
          </div>

        </div>
      </div>
    </div>
  );
}
