import React from 'react';
import { EmailTemplate } from '../types';
import { HelpCircle } from 'lucide-react';

interface TemplateEditorProps {
  template: EmailTemplate;
  setTemplate: (template: EmailTemplate) => void;
  availableVariables: string[];
}

export function TemplateEditor({ template, setTemplate, availableVariables }: TemplateEditorProps) {
  const insertVariable = (variable: string, field: 'subject' | 'body') => {
    const inputId = field === 'subject' ? 'subject-input' : 'body-input';
    const input = document.getElementById(inputId) as HTMLInputElement | HTMLTextAreaElement;
    
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const text = template[field];
      const newText = text.substring(0, start) + `{{${variable}}}` + text.substring(end);
      
      setTemplate({ ...template, [field]: newText });
      
      setTimeout(() => {
        input.focus();
        input.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
      }, 0);
    }
  };

  return (
    <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-base font-semibold text-gray-800">Email Template</h2>
        <p className="text-xs text-gray-500 mt-1">
          Use double curly braces for variables (e.g. <code className="bg-gray-100 px-1 rounded text-pink-600">{'{{Prof Name}}'}</code>). HTML tags like <code className="bg-gray-100 px-1 rounded text-blue-600">&lt;a&gt;</code> are supported.
        </p>
      </div>
      
      <div className="p-4 space-y-4">
        {availableVariables.length > 0 && (
          <div className="mb-4 p-3 bg-blue-50/50 rounded border border-blue-100">
            <div className="flex items-center text-xs font-medium text-blue-800 mb-2">
              <HelpCircle size={14} className="mr-1.5" />
              Available variables:
            </div>
            <div className="flex flex-wrap gap-2">
              {availableVariables.filter(v => v.toLowerCase() !== 'id').map(variable => (
                <div key={variable} className="flex space-x-1">
                  <button
                    onClick={() => insertVariable(variable, 'subject')}
                    className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors text-gray-600 uppercase font-medium"
                    title={`Insert {{${variable}}} into subject`}
                  >
                    +Subj {variable}
                  </button>
                  <button
                    onClick={() => insertVariable(variable, 'body')}
                    className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded shadow-sm hover:bg-gray-50 transition-colors text-gray-600 uppercase font-medium"
                    title={`Insert {{${variable}}} into body`}
                  >
                    +Body {variable}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="subject-input" className="block text-xs font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            id="subject-input"
            type="text"
            value={template.subject}
            onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow text-sm"
            placeholder="Application for Research Internship - {{Prof Name}}"
          />
        </div>

        <div>
          <label htmlFor="body-input" className="block text-xs font-medium text-gray-700 mb-1">
            Email Body
          </label>
          <textarea
            id="body-input"
            rows={15}
            value={template.body}
            onChange={(e) => setTemplate({ ...template, body: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow font-mono text-[13px] leading-relaxed"
            placeholder="Dear Prof. {{Prof Name}},&#10;&#10;I am writing to express my interest..."
          />
        </div>
      </div>
    </div>
  );
}
