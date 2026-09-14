import api from './api';
import {
  AnalyticsOverviewData,
  ActivityAnalyticsData,
  BulkUserActionPayload,
  BulkUserActionResult,
} from '../types/adminAnalytics';

export const adminAnalyticsService = {
  getOverview: async (): Promise<AnalyticsOverviewData> => {
    const response = await api.get<{ success: boolean; data: AnalyticsOverviewData }>(
      '/admin/analytics/overview'
    );
    return response.data.data;
  },

  getActivity: async (days: number = 30): Promise<ActivityAnalyticsData> => {
    const response = await api.get<{ success: boolean; data: ActivityAnalyticsData }>(
      `/admin/analytics/activity?days=${days}`
    );
    return response.data.data;
  },

  performBulkAction: async (payload: BulkUserActionPayload): Promise<BulkUserActionResult> => {
    const response = await api.post<{ success: boolean; data: BulkUserActionResult }>(
      '/admin/users/bulk-action',
      payload
    );
    return response.data.data;
  },
};
