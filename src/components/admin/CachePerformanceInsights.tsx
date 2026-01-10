import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Button } from "../ui/button";
import { 
  TrendingUp,
  TrendingDown,
  Target,
  Lightbulb,
  BarChart3
} from "lucide-react";
import { cachePerformance } from "../../services/cacheService";

export function CachePerformanceInsights() {
  const [report, setReport] = React.useState(cachePerformance.getPerformanceReport());

  const refreshReport = () => {
    setReport(cachePerformance.getPerformanceReport());
    cachePerformance.logPerformanceInsights();
  };

  const getEfficiencyColor = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent': return 'text-green-600 border-green-300 bg-green-50';
      case 'good': return 'text-blue-600 border-blue-300 bg-blue-50';
      case 'fair': return 'text-yellow-600 border-yellow-300 bg-yellow-50';
      case 'poor': return 'text-red-600 border-red-300 bg-red-50';
      default: return 'text-gray-600 border-gray-300 bg-gray-50';
    }
  };

  const getEfficiencyIcon = (efficiency: string) => {
    switch (efficiency) {
      case 'excellent':
      case 'good':
        return <TrendingUp className="h-4 w-4" />;
      case 'fair':
        return <Target className="h-4 w-4" />;
      case 'poor':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Cache Performance Insights
          </CardTitle>
          <Button onClick={refreshReport} variant="outline" size="sm">
            <TrendingUp className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Performance Overview */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Cache Efficiency</div>
            <Badge 
              variant="outline" 
              className={getEfficiencyColor(report.efficiency)}
            >
              {getEfficiencyIcon(report.efficiency)}
              <span className="ml-1 capitalize">{report.efficiency}</span>
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Hit Ratio</div>
            <Badge variant="outline" className="text-lg">
              {(report.hitRatio * 100).toFixed(1)}%
            </Badge>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Cache Entries</span>
            <Badge variant="outline">{report.entries}</Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Hits</span>
            <Badge variant="outline" className="text-green-600 border-green-300">
              {report.hits}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total Misses</span>
            <Badge variant="outline" className="text-red-600 border-red-300">
              {report.misses}
            </Badge>
          </div>
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="text-blue-700">
                <strong>Performance Recommendations:</strong>
                <ul className="mt-2 space-y-1 text-sm">
                  {report.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-1">
                      <span className="text-blue-500">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}