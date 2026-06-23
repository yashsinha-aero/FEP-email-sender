import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import { UploadCloud, FileText, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';

interface CsvUploaderProps {
  onDataLoaded: (data: any[], headers: string[]) => void;
}

interface FilteredRow {
  index: number;
  name: string;
  email: string;
  reason: 'Mailed in 2026' | 'Blank Email' | 'Blank Name' | 'Empty Row';
}

export function CsvUploader({ onDataLoaded }: CsvUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [filteredOutRows, setFilteredOutRows] = useState<FilteredRow[]>([]);
  const [showFiltered, setShowFiltered] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<'index' | 'name' | 'email' | 'reason'>('index');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleSort = (key: 'index' | 'name' | 'email' | 'reason') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const sortedFilteredRows = [...filteredOutRows].sort((a, b) => {
    let comparison = 0;
    if (sortKey === 'index') {
      comparison = a.index - b.index;
    } else {
      const valA = a[sortKey].toString().toLowerCase();
      const valB = b[sortKey].toString().toLowerCase();
      if (valA < valB) comparison = -1;
      if (valA > valB) comparison = 1;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);
    setFilteredOutRows([]);
    setShowFiltered(false);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('Error parsing CSV. Please check the file format.');
          console.error(results.errors);
          return;
        }

        const data = results.data as any[];
        const headers = results.meta.fields || [];

        const emailHeader = headers.find(h => h.toLowerCase().includes('email'));
        if (!emailHeader) {
          setError('Warning: Could not find an "email" column in the CSV. You might need to adjust your CSV headers.');
        }

        const profNameHeader = headers.find(h => h.toLowerCase().includes('prof name'));
        const mailedByHeader = headers.find(h => h.toLowerCase().includes('mailed by(2026)'));

        const filteredOutList: FilteredRow[] = [];
        const validList: any[] = [];

        data.forEach((row, idx) => {
          const nameVal = profNameHeader ? row[profNameHeader]?.trim() : '';
          const emailVal = emailHeader ? row[emailHeader]?.trim() : '';
          const mailedByVal = mailedByHeader ? row[mailedByHeader]?.trim() : '';

          if (Object.values(row).every(val => !(val as string)?.trim())) {
            filteredOutList.push({
              index: idx + 1,
              name: nameVal || '(Empty)',
              email: emailVal || '(Empty)',
              reason: 'Empty Row'
            });
            return;
          }

          if (mailedByVal) {
            filteredOutList.push({
              index: idx + 1,
              name: nameVal || '(Empty)',
              email: emailVal || '(Empty)',
              reason: 'Mailed in 2026'
            });
            return;
          }

          if (!emailVal) {
            filteredOutList.push({
              index: idx + 1,
              name: nameVal || '(Empty)',
              email: emailVal || '(Empty)',
              reason: 'Blank Email'
            });
            return;
          }

          if (!nameVal) {
            filteredOutList.push({
              index: idx + 1,
              name: nameVal || '(Empty)',
              email: emailVal || '(Empty)',
              reason: 'Blank Name'
            });
            return;
          }

          validList.push(row);
        });

        const dataWithIds = validList.map((row, index) => ({
          ...row,
          id: `row-${index}-${Date.now()}`
        }));

        setFilteredOutRows(filteredOutList);

        if (filteredOutList.length > 0) {
          setError(`Filtered out ${filteredOutList.length} records. Please review the details below.`);
        }

        onDataLoaded(dataWithIds, headers);
      },
      error: (err) => {
        setError(`Error reading file: ${err.message}`);
      }
    });
  };

  return (
    <div className="w-full">
      <div
        className="border-2 border-dashed border-gray-300 rounded p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer bg-white"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept=".csv"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <div className="flex flex-col items-center justify-center space-y-2">
          <UploadCloud size={24} className="text-gray-400 mb-1" />
          <div>
            <p className="text-sm font-medium text-gray-800">
              Click to upload CSV
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Must contain column headers
            </p>
          </div>
        </div>
      </div>

      {fileName && !error && (
        <div className="mt-4 flex items-center p-3 bg-green-50 text-green-700 rounded-lg border border-green-100">
          <FileText size={18} className="mr-2" />
          <span className="text-sm font-medium">Loaded: {fileName}</span>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start p-3 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
          <AlertCircle size={18} className="mr-2 mt-0.5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {filteredOutRows.length > 0 && (
        <div className="mt-4 border border-gray-200 rounded bg-white overflow-hidden">
          <button
            onClick={() => setShowFiltered(prev => !prev)}
            className="w-full flex items-center justify-between p-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Filtered Rows ({filteredOutRows.length})</span>
            {showFiltered ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showFiltered && (
            <div className="border-t border-gray-100 p-3">
              <div className="overflow-x-auto max-h-60">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium select-none">
                      <th
                        onClick={() => handleSort('index')}
                        className="pb-2 cursor-pointer hover:text-gray-700"
                      >
                        Row # {sortKey === 'index' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th
                        onClick={() => handleSort('name')}
                        className="pb-2 cursor-pointer hover:text-gray-700"
                      >
                        Name {sortKey === 'name' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th
                        onClick={() => handleSort('email')}
                        className="pb-2 cursor-pointer hover:text-gray-700"
                      >
                        Email {sortKey === 'email' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                      <th
                        onClick={() => handleSort('reason')}
                        className="pb-2 cursor-pointer hover:text-gray-700"
                      >
                        Reason {sortKey === 'reason' && (sortOrder === 'asc' ? '▲' : '▼')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {sortedFilteredRows.map((row) => (
                      <tr key={row.index} className="text-gray-600 hover:bg-gray-50/50">
                        <td className="py-2 font-medium">{row.index}</td>
                        <td className="py-2 truncate max-w-[120px]">{row.name}</td>
                        <td className="py-2 truncate max-w-[150px]">{row.email}</td>
                        <td className="py-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${row.reason === 'Mailed in 2026' ? 'bg-gray-100 text-gray-700' :
                              row.reason === 'Blank Email' ? 'bg-red-50 text-red-700 border border-red-100' :
                                row.reason === 'Blank Name' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' :
                                  'bg-gray-50 text-gray-500'
                            }`}>
                            {row.reason}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
