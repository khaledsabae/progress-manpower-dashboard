// src/components/icons.ts
import {
  // Icons previously defined
  ArrowUp,
  ArrowDown,
  Calendar as CalendarIcon,
  Loader2,
  Download,
  CheckCircle,
  PauseCircle,
  HelpCircle,
  List,
  BarChartHorizontal,

  // Icons needed for ExecutiveSummaryTab
  Target,
  Users,
  TrendingUp,
  AlertCircle, // Keep or change to AlertTriangle below
  PackageX,
  BarChartBig,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  CalendarClock,

  // Icons needed for Material Tab
  Truck,
  PackageCheck,
  PackageSearch,
  Package,
  Link as LinkIcon,

  // *** ADDED MISSING ICONS FOR ProgressTab ***
  Wind, // Using Wind for HVAC - choose another if you prefer
  Flame,
  Siren,
  AlertTriangle, // Added this, you can use either AlertCircle or AlertTriangle

  // Add any other icons used elsewhere if needed

} from 'lucide-react';

// Export the Icons object with consistent names
export const Icons = {
  // Existing
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  calendar: CalendarIcon,
  spinner: Loader2,
  download: Download,
  checkCircle: CheckCircle,
  pauseCircle: PauseCircle,
  helpCircle: HelpCircle,
  loader: Loader2,
  tableView: List,
  ganttView: BarChartHorizontal,

  // For ExecutiveSummaryTab
  target: Target,
  users: Users,
  trendingUp: TrendingUp,
  // Decide which alert icon to use consistently:
  alertCircle: AlertCircle, // Keep this?
  alertTriangle: AlertTriangle, // Or use this? Let's use alertTriangle for ProgressTab error state
  packageX: PackageX,
  barChartBig: BarChartBig,
  minus: Minus,
  arrowUpRight: ArrowUpRight,
  arrowDownRight: ArrowDownRight,
  calendarClock: CalendarClock,

  // For MaterialTab
  truck: Truck,
  packageCheck: PackageCheck,
  packageSearch: PackageSearch,
  packageIcon: Package, // Renamed from 'package' to avoid conflict
  link: LinkIcon,

  // *** ADDED FOR ProgressTab ***
  hvac: Wind, // Changed from Users to Wind for HVAC card
  flame: Flame,
  siren: Siren,
  // alertTriangle is already added above

};

// Optional: Export types if needed
export type IconKeys = keyof typeof Icons;