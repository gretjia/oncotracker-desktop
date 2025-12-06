/**
 * OncoTracker Schema Module
 * 
 * This module exports all schema-related utilities for the canonical
 * 张莉.xlsx data format.
 * 
 * @version 1.0.0
 */

// Core Schema
export {
  SCHEMA_VERSION,
  FIXED_COLUMNS,
  COLUMN_KEYS,
  ROW_INDICES,
  FIRST_METRIC_COLUMN,
  METRIC_CATEGORIES,
  CANONICAL_HEADERS,
  CANONICAL_UNITS,
  DataRowSchema,
  HeaderRowSchema,
  DatasetSchema,
  validateDatasetStructure,
  detectDataFormat,
  getSchemeColumnKey,
  getEventColumnKey,
  type DataRow,
  type Dataset,
  type FixedColumnKey,
  type MetricCategory,
} from './oncology-dataset.schema';

// Metric Dictionary
export {
  METRIC_DICTIONARY,
  lookupMetric,
  getCanonicalMetricName,
  isKnownMetric,
  getMetricsByCategory,
  getAllCanonicalMetricNames,
  getMetricColumnIndex,
  generateMetricReferenceForAI,
  generateColumnStructureForAI,
  type MetricDefinition,
} from './metric-dictionary';

// Data Transformer
export {
  generateCanonicalHeaders,
  transformToCanonicalFormat,
  validateCanonicalData,
  writeCanonicalXLSX,
  type TransformResult,
  type MappingConfig,
} from './data-transformer';

// Template Generator
export {
  generateCanonicalTemplate,
  generateMinimalTemplate,
  generateMolecularTemplate,
  listAvailableMetrics,
  generateReferenceSheet,
  type TemplateOptions,
} from './template-generator';

