// src/components/ProactiveNotifications.tsx
// Component for displaying autonomous proactive notifications

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, TrendingUp, TrendingDown, Users, X, Check } from "lucide-react";
import { getActiveNotifications, acknowledgeNotification, getNotificationSummary, ProactiveNotification } from '@/services/autonomous-insights';

interface ProactiveNotificationsProps {
  onNotificationClick?: (notification: ProactiveNotification) => void;
  compact?: boolean;
}

const ProactiveNotifications: React.FC<ProactiveNotificationsProps> = ({
  onNotificationClick,
  compact = false
}) => {
  const [notifications, setNotifications] = useState<ProactiveNotification[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    recent: [] as ProactiveNotification[]
  });

  useEffect(() => {
    // Load notifications on component mount
    loadNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = () => {
    const active = getActiveNotifications();
    const summaryData = getNotificationSummary();
    setNotifications(active);
    setSummary(summaryData);
  };

  const handleAcknowledge = (notificationId: string) => {
    if (acknowledgeNotification(notificationId)) {
      loadNotifications(); // Refresh the list
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getSeverityIcon = (type: string) => {
    switch (type) {
      case 'critical_risk': return <AlertTriangle className="h-4 w-4" />;
      case 'workforce_shortage': return <Users className="h-4 w-4" />;
      case 'trend_alert': return <TrendingUp className="h-4 w-4" />;
      default: return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (compact) {
    // Compact view for dashboard header
    if (summary.total === 0) return null;

    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <span className="text-sm text-yellow-800">
          {summary.critical > 0 && `🚨 ${summary.critical} Critical • `}
          {summary.high > 0 && `⚠️ ${summary.high} High • `}
          Proactive insights available
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNotificationClick?.(summary.recent[0])}
          className="ml-auto"
        >
          View
        </Button>
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            Proactive Insights Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
              <div className="text-sm text-gray-600">Total Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.critical}</div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.high}</div>
              <div className="text-sm text-gray-600">High</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.medium}</div>
              <div className="text-sm text-gray-600">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.low}</div>
              <div className="text-sm text-gray-600">Low</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Notifications */}
      <div className="space-y-3">
        {summary.recent.map((notification) => (
          <Card key={notification.id} className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {getSeverityIcon(notification.type)}
                    <Badge className={`${getSeverityColor(notification.severity)} text-white`}>
                      {notification.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(notification.timestamp)}
                    </span>
                  </div>

                  <h4 className="font-semibold text-gray-900 mb-1">
                    {notification.title}
                  </h4>

                  <p className="text-sm text-gray-700 mb-3">
                    {notification.message}
                  </p>

                  {notification.recommendations.length > 0 && (
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-gray-900 mb-1">
                        Recommended Actions:
                      </h5>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {notification.recommendations.slice(0, 3).map((rec, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onNotificationClick?.(notification)}
                  >
                    Details
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleAcknowledge(notification.id)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {summary.recent.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center">
              <div className="text-gray-400 mb-2">
                <AlertTriangle className="h-8 w-8 mx-auto" />
              </div>
              <p className="text-gray-600">
                No active notifications at this time.
              </p>
              <p className="text-sm text-gray-500 mt-1">
                The system runs automated analysis daily to identify potential issues.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default ProactiveNotifications;
