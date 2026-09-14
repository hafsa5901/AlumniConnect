import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Building2, School } from 'lucide-react';

interface DistributionItem {
  name: string;
  count: number;
}

interface DepartmentDistributionListProps {
  departments: DistributionItem[];
  companies: DistributionItem[];
}

export const DepartmentDistributionList: React.FC<DepartmentDistributionListProps> = ({
  departments,
  companies,
}) => {
  const maxDept = Math.max(1, ...departments.map((d) => d.count));
  const maxComp = Math.max(1, ...companies.map((c) => c.count));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Departments */}
      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <School className="w-5 h-5 text-blue-600" />
          <div>
            <CardTitle className="text-base font-bold text-navy-900">Top Departments</CardTitle>
            <p className="text-xs text-slate-500">Distribution of registered community members</p>
          </div>
        </CardHeader>
        <CardContent>
          {departments.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No department data available.</p>
          ) : (
            <div className="space-y-3">
              {departments.map((dept, idx) => {
                const percentage = Math.round((dept.count / maxDept) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-navy-900 truncate max-w-[75%]">{dept.name}</span>
                      <span className="text-slate-500">{dept.count} members</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Companies */}
      <Card className="border border-slate-200/80 shadow-xs">
        <CardHeader className="pb-3 flex flex-row items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600" />
          <div>
            <CardTitle className="text-base font-bold text-navy-900">Top Alumni Employers</CardTitle>
            <p className="text-xs text-slate-500">Industry and organizational presence</p>
          </div>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No company representation data available.</p>
          ) : (
            <div className="space-y-3">
              {companies.map((comp, idx) => {
                const percentage = Math.round((comp.count / maxComp) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-navy-900 truncate max-w-[75%]">{comp.name}</span>
                      <span className="text-slate-500">{comp.count} alumni</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
