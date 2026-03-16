/**
 * Validation result types for the XPS Intelligence validation system.
 * Used by the multi-layer validation pipeline and agent validators.
 */

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface SyntaxValidationResult extends ValidationResult {
  language: 'typescript' | 'python' | 'javascript';
}

export interface TypeCheckResult extends ValidationResult {
  typedPercentage: number;
}

export interface LintResult extends ValidationResult {
  score: number;
  fixable: number;
}

export interface SecurityScanResult extends ValidationResult {
  vulnerabilities: SecurityVulnerability[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
}

export interface SecurityVulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  packageName: string;
  fixAvailable: boolean;
}

export interface PerformanceResult {
  passed: boolean;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  timeToInteractive: number;
  bundleSizeKb: number;
}

export interface DependencyUpdateInfo {
  packageName: string;
  currentVersion: string;
  latestVersion: string;
  type: 'patch' | 'minor' | 'major';
  hasVulnerability: boolean;
}

export interface DependencyUpdateReport {
  checkedAt: string;
  updatesAvailable: DependencyUpdateInfo[];
  securityFixes: SecurityVulnerability[];
  status: 'up-to-date' | 'updates-available' | 'security-critical';
}

export interface FullValidationReport {
  timestamp: string;
  overallPassed: boolean;
  lint: LintResult;
  types: TypeCheckResult;
  security: SecurityScanResult;
  performance: PerformanceResult;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}
