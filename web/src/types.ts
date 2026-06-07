export type SourceState = 'ok' | 'degraded' | 'unavailable' | string;

export interface ConsoleSource {
  id: string;
  label: string;
  owner: string;
  panel: string;
  url: string;
  transport?: string;
  data_plane?: string;
  http_status: number;
  state: SourceState;
  duration_ms: number;
  preview: string;
}

export interface ConsoleOverview {
  schema: string;
  generated_at: string;
  owner: string;
  authority: string;
  truth_rule: string;
  sources: ConsoleSource[];
  summary: {
    ok: number;
    degraded_or_unavailable: number;
    total: number;
  };
}

export interface EvidenceNode {
  id: string;
  label: string;
  owner: string;
  transport?: string;
  data_plane?: string;
  state: SourceState;
  http_status: number;
  duration_ms: number;
  detail_path: string;
  preview: string;
}

export interface EvidenceEdge {
  from: string;
  to: string;
  label: string;
}

export interface EvidenceChain {
  schema: string;
  generated_at: string;
  nodes: EvidenceNode[];
  edges: EvidenceEdge[];
}

export interface SourceDetail<T = unknown> {
  schema: string;
  generated_at: string;
  id: string;
  label: string;
  owner: string;
  url: string;
  transport?: string;
  data_plane?: string;
  http_status: number;
  ok: boolean;
  duration_ms: number;
  error: string;
  logger_call_evidence?: {
    schema: string;
    generated_at: string;
    owner: string;
    source: string;
    proof_source: string;
    data_plane: string;
    request_id: string;
    correlation_id: string;
    ok: boolean;
    ingest_ok: boolean;
    ingest_http_status: number;
    ingest_duration_ms: number;
    ingest_stored_count: number;
    proof_ok: boolean;
    proof_http_status: number;
    proof_duration_ms: number;
    proof_gate_status: string;
    proof_event_count: number;
    proof_request_seen: boolean;
    error: string;
  };
  payload: T;
}

export interface LoggerIncidentStreamProof {
  schema: string;
  generated_at: string;
  owner: string;
  source: string;
  bus_url: string;
  data_plane: string;
  ok: boolean;
  http_status: number;
  duration_ms: number;
  sse_event_count: number;
  log_count: number;
  incident_id_count: number;
  correlation_id_count: number;
  incident_timeline_count: number;
  has_logs: boolean;
  has_incident_timelines: boolean;
  has_correlations: boolean;
  error: string;
  preview: string;
}

export interface LoggerRequestProofDepth {
  schema: string;
  generated_at: string;
  owner: string;
  source: string;
  proof_scope: string;
  bus_url: string;
  data_plane: string;
  ok: boolean;
  request_specific_ready: boolean;
  state: string;
  http_status: number;
  duration_ms: number;
  event_count: number;
  missing_correlation_count: number;
  correlation_id_count: number;
  request_id_count: number;
  incident_id_count: number;
  migration_id_count: number;
  outcome_id_count: number;
  lifecycle_stage_count: number;
  sample_correlation_id: string;
  sample_request_id: string;
  sample_incident_id: string;
  open_gate: string;
  error: string;
  preview: string;
}

export interface AmberBusNativeHealthPayload {
  schema: string;
  generated_at: string;
  overall_state: string;
  status: string;
  service: string;
  fd_pressure?: {
    open_fds?: number;
    nofile_soft?: number;
    accept_queue_depth?: number;
    accept_queue_max?: number;
    accept_fd_pressure_events?: number;
    accept_queue_rejections?: number;
  };
  socket_state?: {
    schema: string;
    listen_port: number;
    source: string;
    state: string;
    total_for_listen_port: number;
    listen: number;
    established: number;
    close_wait: number;
    time_wait: number;
    states: Record<string, number>;
  };
  active_client_pressure?: {
    schema: string;
    active_count: number;
    closed_peer_active_count: number;
    closed_peer_dropped_count: number;
    closed_peer_seen_count: number;
    longest_active_ms: number;
    sample: Array<{
      fd: number;
      peer: string;
      method: string;
      target: string;
      path: string;
      lane: string;
      state: string;
      peer_closed: boolean;
      age_ms: number;
    }>;
  };
}

export interface OwnerActionReadinessOwner {
  owner_id: string;
  owner_host: string;
  stage: string;
  authority: {
    read_authority: string;
    write_authority: string;
    display_cache_is_truth: boolean;
    private_file_api_allowed: boolean;
  };
  capability_counts: {
    read: number;
    write: number;
    events: number;
  };
  write_capabilities: string[];
  bus_identity: {
    source_app_id: string;
    native_client_required: boolean;
    correlation_required: boolean;
    profile_ref: string;
  };
  comparison: {
    compare_required: boolean;
    compare_ref: string;
    failure_classification_required: boolean;
    runtime_proof_status: string;
  };
  promotion: {
    promotion_status: string;
    promotion_gate: string;
    retirement_gate: string;
  };
  rollback: {
    fallback_mode: string;
    fallback_ref: string;
    preserves_owner_truth: boolean;
    execution_proof_status: string;
  };
  display_policy: {
    display_route_allowed: boolean;
    display_route_is_authority: boolean;
    raw_private_payload_visible: boolean;
  };
  action_ready: boolean;
  action_dispatch_allowed: boolean;
  missing_gates: string[];
}

export interface OwnerActionReadinessPayload {
  schema: string;
  generated_at: string;
  owner_app_id: string;
  data_plane: string;
  source_fixture: {
    fixture_pack_id: string;
    status: string;
    non_runtime_contract: boolean;
    path: string;
  };
  summary: {
    go_no_go: string;
    ready_for_action_dispatch: boolean;
    mutation_allowed: boolean;
    owner_count: number;
    write_owner_count: number;
    rollback_contract_count: number;
    correlation_required_count: number;
    private_policy_clear_count: number;
    action_ready_count: number;
    blocked_action_count: number;
    raw_private_payload_visible: boolean;
  };
  owners: OwnerActionReadinessOwner[];
  evidence_refs: string[];
}

export interface RouterTreeNode {
  id: string;
  label: string;
  kind: string;
  field?: string;
  operator?: string;
  value?: string;
  yes?: string;
  no?: string;
  weights?: Record<string, number>;
}

export interface VeliaiEndpoint {
  id: string;
  name: string;
  provider: string;
  kind: string;
  endpoint_url: string;
  enabled: boolean;
  local: boolean;
  supports_streaming: boolean;
  privacy_class: string;
  capabilities: string[];
  modalities: string[];
  health: string;
  priority: number;
  route_weight: number;
  model?: {
    id?: string;
    alias?: string;
    lane?: string;
    context_length?: number;
    max_output_tokens?: number;
  };
  cost?: {
    monthly_subscription_usd?: number;
    input_usd_per_mtok?: number;
    output_usd_per_mtok?: number;
  };
  usage_month?: {
    month?: string;
    input_tokens?: number;
    output_tokens?: number;
    requests?: number;
  };
}

export interface VeliaiProviderCatalog {
  schema: string;
  source: string;
  registry_path: string;
  usage_path: string;
  secrets_policy: string;
  routing_tree: {
    schema: string;
    entry: string;
    nodes: RouterTreeNode[];
  };
  endpoints: VeliaiEndpoint[];
}

export interface GemmaLane {
  lane: string;
  inflight: number;
  queued: number;
  max_inflight: number;
  max_queued: number;
  circuit: string;
  circuit_open: boolean;
}

export interface GemmaLanesPayload {
  lanes: GemmaLane[];
  workers?: {
    workers?: Array<{
      handle: string;
      port: number;
      state: string;
      healthy: boolean;
      device: string;
      model_path: string;
    }>;
  };
}

export interface HardwarePayload {
  nvidia?: {
    available: boolean;
    gpus?: Array<{
      device: string;
      name: string;
      temperature_c: number;
      utilization_gpu_pct: number;
      memory_total_mib: number;
      memory_used_mib: number;
      thermal_state: string;
    }>;
  };
  amd_rocm?: {
    available: boolean;
    raw_preview?: string;
  };
}

export interface VeliaiUsagePayload {
  schema: string;
  generated_at: string;
  month: string;
  summary: {
    input_tokens: number;
    output_tokens: number;
    requests: number;
    estimated_cost_usd: number;
  };
  usage: Array<{
    endpoint_id: string;
    provider: string;
    model_id: string;
    input_tokens: number;
    output_tokens: number;
    requests: number;
    estimated_cost_usd: number;
    backpressure_state?: string;
    usage_visibility?: string;
  }>;
}

export interface VeliaiQueueSummary {
  schema: string;
  ok: boolean;
  source: string;
  status_function: string;
  artifacts_function: string;
  summary: Record<string, number>;
  governance?: {
    ok?: boolean;
    state?: string;
    issues?: string[];
    pending?: number;
    failed?: number;
    failed_recent?: number;
    failure_health_window_sec?: number;
    pressure_level?: number;
    allowed_actions?: string[];
    reaped?: Record<string, number>;
  };
  recent_records?: Array<{
    request_id?: string;
    source_app?: string;
    job_type?: string;
    status?: string;
    provider?: string;
    model?: string;
    attempts?: number;
    priority?: number;
    created_at?: string;
    updated_at?: string;
    error?: string;
  }>;
  created_at: string;
  detail_routes?: Record<string, string>;
  heavy_route_note?: string;
}

export interface VeliaiQueueArtifactsSummary {
  schema: string;
  ok: boolean;
  source: string;
  available_targets: string[];
  supervisor_status?: {
    schema: string;
    ok: boolean;
    state: string;
    unhealthy: boolean;
    pending_requests: number;
    dead_requests: number;
    dead_requests_total: number;
    summary: Record<string, number>;
    governance?: VeliaiQueueSummary['governance'];
    updated_at: string;
  };
  recent_records?: VeliaiQueueSummary['recent_records'];
  detail_routes?: Record<string, string>;
  heavy_route_note?: string;
  created_at: string;
}

export interface MemorrArchiveStatus {
  schema?: string;
  ok: boolean;
  owner?: string;
  path_api?: boolean;
  email_count: number;
  attachment_count: number;
  document_version_count: number;
  sealed_count: number;
  quarantine_evidence_count: number;
  no_store_attachment_count: number;
  pending_ocr_or_classification_count: number;
}

export interface MemorrMirrorStatus {
  schema?: string;
  owner?: string;
  state?: string;
  semantic_job_count?: number;
  ready_job_count?: number;
  pending_job_count?: number;
  failed_job_count?: number;
  ocr_job_count?: number;
  veliai_document_job_count?: number;
  derived_blob_count?: number;
  classification_result_count?: number;
  processing_quarantine_count?: number;
  private_sensitive_job_count?: number;
  ordinary_context_blocked_count?: number;
  raw_payload_exposed_to_lsb?: boolean;
  memorr_is_owner_truth?: boolean;
  veliai_is_executor?: boolean;
  recent_jobs?: Array<Record<string, string | number | boolean>>;
  object_count?: number;
  logical_ref_count?: number;
  deduplicated_objects?: number;
  compressed_objects?: number;
  pass_through_objects?: number;
  service_state?: string;
  roots?: Record<string, { in_sync: number; pending: number; failed: number; blocked: number }>;
}

export interface MemorrSourceStatus {
  schema?: string;
  ok?: boolean;
  owner?: string;
  path_api?: boolean;
  paused?: boolean;
  run_count?: number;
  candidate_count?: number;
  artifact_count?: number;
  pending_count?: number;
  deferred_count?: number;
  latest_run_id?: string;
  latest_state?: string;
  source_count?: number;
  cursor_count?: number;
  asset_count?: number;
  quarantine_count?: number;
}

export interface MemorrExchangeBackfillStatus {
  schema: string;
  ok: boolean;
  owner: string;
  batch_count: number;
  imported_count: number;
  skipped_duplicate_count: number;
  failed_count: number;
  score_only_hygiene_required?: boolean;
  score_only_hygiene_count?: number;
  score_only_hygiene_missing_count?: number;
  hygiene_suppressed_count?: number;
  attachment_imported_count?: number;
  document_version_imported_count?: number;
  raw_mime_imported_count?: number;
  last_email_ref?: string;
  last_raw_object_ref?: string;
  last_raw_mime_sha256?: string;
  last_attachment_ref?: string;
  last_document_version_ref?: string;
  last_folder?: string;
  last_privacy_class?: string;
  historical_hygiene_endpoint_ref?: string;
  last_hygiene_schema?: string;
  last_hygiene_endpoint_ref?: string;
  last_hygiene_verdict_class?: string;
  last_hygiene_spam_action?: string;
  last_exchange_delivery_action?: string;
  last_memorr_action?: string;
  last_batch_ref?: string;
  last_source_protocol?: string;
  last_updated_at?: string;
  read_only_exchange: boolean;
  exchange_mutation_allowed: boolean;
  raw_filter_output_visible_to_intelligence?: boolean;
  raw_payload_stored?: boolean;
  credential_material_included: boolean;
}

export interface MemorrPimContextStatus {
  schema: string;
  ok: boolean;
  owner: string;
  ui_data_plane?: string;
  evidence_count: number;
  email_count: number;
  contact_count: number;
  calendar_count: number;
  promoted_memory_count: number;
  exchange_remains_pim_authority: boolean;
  memorr_mailbox_authority: boolean;
  exchange_mutation_allowed: boolean;
  raw_payload_available_to_gemma: boolean;
  sync?: Record<string, string | number | boolean>;
  dedupe?: Record<string, string | number | boolean>;
  salience?: Record<string, string | number | boolean>;
  authority?: Record<string, string | number | boolean>;
  contextual_memories?: Array<Record<string, string | number | boolean>>;
  topic_timelines?: Array<Record<string, string | number | boolean>>;
  commitments?: Array<Record<string, string | number | boolean>>;
}

export interface MemorrFormulatedMemoryRecall {
  schema: string;
  ok: boolean;
  namespace: string;
  query: string;
  token_budget: number;
  estimated_tokens: number;
  candidate_count: number;
  path_api: boolean;
  candidates?: Array<Record<string, string | number | boolean>>;
}

export interface MemorrEmailTimelineStatus {
  schema: string;
  ok: boolean;
  owner: string;
  ui_data_plane?: string;
  privacy?: Record<string, string | number | boolean>;
  filters?: Record<string, string | number | boolean>;
  summary?: {
    email_count?: number;
    returned_count?: number;
    sealed_count?: number;
    read_lease_count?: number;
    attachment_count?: number;
    document_version_count?: number;
    formulated_memory_count?: number;
  };
  timeline?: Array<Record<string, unknown>>;
}

export interface LsbStateStatus {
  schema: string;
  owner: string;
  state: string;
  records: number;
  indexes: number;
  semantic_air_gap: boolean;
  raw_payload_allowed: boolean;
}

export interface LsbPlanStatus {
  schema: string;
  owner: string;
  state: string;
  accepted: number;
  rejected: number;
  poison_isolated: number;
  neufab_fallbacks: number;
  supported_request_kinds: string[];
  raw_payload_allowed: boolean;
  owner_truth_mutated: boolean;
  semantic_air_gap: boolean;
}

export interface AmberBusApplication {
  app_id: string;
  display_name: string;
  version?: string;
  client_framework_version?: string;
  expected_client_framework_version?: string;
  client_framework_status?: string;
  client_version?: string;
  summary?: string;
  bus_role?: string;
  consumer_only?: boolean;
  capabilities?: string[];
  transports?: string[];
  contracts?: string[];
  published_interface_count?: number;
  functionality_count?: number;
  service_bindings?: AmberBusServiceBindings;
  manifest_source?: {
    effective_source?: string;
    source_manifest?: AmberBusManifestFileEvidence;
    runtime_manifest?: AmberBusManifestFileEvidence;
  };
  bus?: {
    mode?: string;
    role?: string;
    service_bindings?: AmberBusServiceBindings;
    connector?: {
      status?: string;
      registration_mode?: string;
      catalog_sync?: string;
      last_registration_at?: string;
    };
    exposure?: {
      bus_invoke_enabled?: boolean;
      mqtt_request_reply_enabled?: boolean;
      bus_only_in_production?: boolean;
      direct_api_enabled?: boolean;
      direct_api_policy?: string;
    };
  };
}

export interface AmberBusManifestFileEvidence {
  kind?: string;
  path?: string;
  updated_at?: string;
  size_bytes?: number;
}

export interface AmberBusBinding {
  binding_id?: string;
  capability?: string;
  required?: boolean;
  purpose?: string;
}

export interface AmberBusServiceBindings {
  required?: AmberBusBinding[];
  optional?: AmberBusBinding[];
}

export interface AmberBusApplicationsPayload {
  schema: string;
  generated_at: string;
  count: number;
  applications: AmberBusApplication[];
}

export interface AmberBusFunctionality {
  app_id: string;
  app_display_name?: string;
  function_id: string;
  name: string;
  summary?: string;
  stability?: string;
  linked_interfaces?: string[];
  linked_contracts?: string[];
  bus_invocation?: {
    invoke_path?: string;
    invoke_url?: string;
    mqtt_request_topic?: string;
    mqtt_reply_topic?: string;
    mode?: string;
    direct_api_enabled?: boolean;
    bus_only?: boolean;
  };
}

export interface AmberBusFunctionalityPayload {
  schema: string;
  generated_at: string;
  count: number;
  functionalities: AmberBusFunctionality[];
}

export interface AmberBusInterface {
  app_id: string;
  app_display_name?: string;
  interface_id: string;
  kind?: string;
  version?: string;
  stability?: string;
  summary?: string;
  bus_path?: string;
  bus_url?: string;
  bus_mode?: string;
  bus_managed?: boolean;
  direct_access?: {
    enabled?: boolean;
    policy?: string;
  };
  paths?: Array<{
    method?: string;
    path?: string;
  }>;
}

export interface AmberBusContractsPayload {
  schema: string;
  generated_at: string;
  count: number;
  interfaces: AmberBusInterface[];
}

export interface AmberBusConsumeMenuItem {
  app_id?: string;
  id?: string;
  label: string;
  summary?: string;
  functionality_count?: number;
  interface_count?: number;
  bus_mode?: string;
  topic_count?: number;
  suggested_action_labels?: string[];
}

export interface AmberBusConsumeMenuPayload {
  schema: string;
  generated_at: string;
  summary: {
    applications: number;
    functionalities: number;
    interfaces: number;
    mqtt_topics: number;
  };
  menu_sections: Array<{
    id: string;
    title: string;
    items: AmberBusConsumeMenuItem[];
  }>;
}

export interface AmberBusClientHealthPayload {
  schema: string;
  generated_at: string;
  records: Array<Record<string, unknown>>;
}

export interface NeuFabFrame {
  recorded_at?: string;
  request_id?: string;
  frame_id?: string;
  source_part?: string;
  target_part?: string;
  intent?: string;
  transport?: string;
  latency_budget_ms?: number;
  processing_us?: number;
  profile_signal_visible?: boolean;
  memory_signal_visible?: boolean;
  provider_signal_visible?: boolean;
  raw_payload_visible?: boolean;
  owner_refs_only?: boolean;
  owner_ref?: string;
  profile_id?: string;
  memory_ref?: string;
  provider_route_id?: string;
  logger_evidence_ref?: string;
  bus_fallback_ref?: string | null;
}

export interface NeuFabStatus {
  ok: boolean;
  schema: string;
  protocol: string;
  owner: string;
  brain_internal: boolean;
  amber_bus_role: string;
  raw_payload_block: boolean;
  owner_refs_only: boolean;
  bus_fallback_available: boolean;
  allowed_parts: string[];
  frame_count: number;
  last_frame?: NeuFabFrame | null;
  recent_frames?: NeuFabFrame[];
}

export interface NeuFabFeedback {
  recorded_at?: string;
  feedback_id?: string;
  request_id?: string;
  signal_class?: string;
  intensity?: number;
  confidence?: number;
  affected_type?: string;
  affected_ref?: string;
  outcome?: string;
  advisory_delta?: number;
  safety_gate?: string;
  raw_payload_visible?: boolean;
}

export interface NeuFabFeedbackStatus {
  ok: boolean;
  schema: string;
  owner: string;
  advisory_only: boolean;
  owner_apply_granted: boolean;
  physical_apply_allowed: boolean;
  model_weight_training: boolean;
  raw_payload_block: boolean;
  feedback_count: number;
  pain_count: number;
  pleasure_count: number;
  context_count: number;
  last_feedback?: NeuFabFeedback | null;
  recent_feedback?: NeuFabFeedback[];
}

export interface NeuFabPerceptionEvent {
  recorded_at?: string;
  request_id?: string;
  semantic_ref?: string;
  event_type?: string;
  source_system?: string;
  source_ref?: string;
  owner_ref?: string;
  profile_id?: string;
  identity_confidence?: number;
  privacy_class?: string;
  context_visibility?: string;
  gemma_context_hint?: string;
  memorr_archive_candidate?: boolean;
  guardian_action_candidate?: boolean;
  raw_payload_visible?: boolean;
}

export interface NeuFabPerceptionStatus {
  ok: boolean;
  schema: string;
  owner: string;
  raw_payload_block: boolean;
  canonical_memory_written: boolean;
  guardian_apply_granted: boolean;
  memorr_handoff_is_candidate_only: boolean;
  event_count: number;
  event_counts: Record<string, number>;
  last_event?: NeuFabPerceptionEvent | null;
  recent_events?: NeuFabPerceptionEvent[];
}

export interface MemoryConciergeFlowNode {
  id: string;
  label: string;
  owner: string;
  state: string;
  tone: string;
  metric: string;
  note: string;
  detail: string;
}

export interface MemoryConciergeFlowEdge {
  from: string;
  to: string;
  label: string;
  active: boolean;
}

export interface MemoryConciergeFlow {
  schema: string;
  owner: string;
  generated_at: string;
  correlation_id: string;
  message_ref?: string;
  latest_activity_at?: string;
  ui_data_plane: string;
  raw_payload_policy: {
    lsb_raw_payload_allowed?: boolean;
    neufab_raw_payload_allowed?: boolean;
    console_direct_owner_calls_allowed?: boolean;
    mailbox_credentials_visible?: boolean;
  };
  summary: Record<string, number>;
  latest_decision?: {
    route?: string;
    route_action?: string;
    spam_action?: string;
    poison_state?: string;
    memorr_delivery_state?: string;
    exchange_delivery_state?: string;
    gemma_index_state?: string;
  };
  nodes: MemoryConciergeFlowNode[];
  edges: MemoryConciergeFlowEdge[];
  evidence: Array<{ label: string; value: string }>;
  operator_controls?: Array<{
    group: string;
    owner: string;
    controls: Array<{
      id: string;
      label: string;
      method: string;
      path: string;
      action?: string;
      enabled: boolean;
      safe: boolean;
    }>;
  }>;
  clickthroughs?: Array<{ label: string; console_target: string }>;
  go_no_go?: Record<string, string>;
}
