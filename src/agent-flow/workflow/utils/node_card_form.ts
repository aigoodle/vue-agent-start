/**
 * Per-node default `data` shape, keyed by the SAME identifier the FlowDesigner
 * registers its `#node-XXX` slot under and stores on `node.type`. Aligned with
 * the backend `NodeType` enum (UPPER_SNAKE) so a saved graph round-trips
 * cleanly — no adapter translation needed between the designer and the engine.
 *
 * Designer-only entries with no backend {@code NodeType} equivalent
 * ({@code USER_INPUT}, {@code FILE_UPLOAD}, {@code HUMAN_INPUT}, {@code LOOP})
 * still use the UPPER_SNAKE convention for consistency; the backend's
 * {@code NodeType.fromJson} maps them onto the closest engine node at run
 * time (USER_INPUT/FILE_UPLOAD/HUMAN_INPUT → START, LOOP → ITERATION).
 */
const nodeCardForm: any = {
  START: {
    variables: [],
    sysVariables: [
      { name: 'query', type: 'String', required: true },
      { name: 'files', type: 'Array[File]' },
      { name: 'dialogue_count', type: 'Number' },
      { name: 'conversation_id', type: 'String' },
      { name: 'user_id', type: 'String' },
      { name: 'app_id', type: 'String' },
      { name: 'workflow_id', type: 'String' },
      { name: 'workflow_run_id', type: 'String' },
    ],
    triggers: {},
    triggersEnabled: false,
    structOutput: {
      schema: {},
      data: [
        {
          id: '0',
          type: 'object',
          name: 'triggers',
          value: '',
          description: '触发器输出',
          hidden: true,
          children: [],
        },
      ],
    },
    output: [{ type: 'string', name: 'query', value: '', label: '用户查询' }],
  },
  ANSWER: {
    answer: '',
  },
  AGENT: {
    modelId: '',
    context: '',
    system: '',
    selectOptions: [],
    required: false,
    memory: {
      window: {
        enabled: true,
        size: 10,
        user: '0',
        assistant: '0',
      },
    },
    model: {
      completionParams: {},
      modelId: 'chat',
    },
    systemPrompt: {
      id: 'prompt_template',
      role: 'system',
      text: '',
    },
    userPrompt: {
      id: 'user_prompt_template',
      role: 'user',
      text: '用户查询：{{#var.query#}}',
    },
    tools: [],
    agentParameters: {},
    output: [
      { type: 'string', name: 'text', value: '', label: '生成内容' },
      { type: 'file', name: 'file', value: null, label: '生成文件' },
      { type: 'object', name: 'json', value: {}, label: '生成Json' },
    ],
  },
  LLM: {
    temperature: 0.7,
    max_tokens: 1000,
    prompt: '',
    model: {
      completionParams: {},
      modeId: '',
      mode: 'chat',
    },
    systemPrompt: {
      id: 'prompt_template',
      role: 'system',
      text: '',
    },
    userPrompt: {
      id: 'user_prompt_template',
      role: 'user',
      text: '用户查询：{{#var.query#}}',
    },
    memory: {
      query_prompt_template: '{{#sys.query#}}',
      role_prefix: {
        assistant: '',
        user: '',
      },
      window: {
        enabled: true,
        size: 10,
        user: '0',
        assistant: '0',
      },
    },
    structOutputEnabled: false,
    structOutput: {
      schema: {},
      data: [
        {
          id: '0',
          type: 'object',
          name: 'struct',
          value: '',
          description: '结构化内容',
          hidden: true,
          children: [],
        },
      ],
    },
    output: [{ type: 'string', name: 'text', value: '', label: '生成内容' }],
  },
  QUESTION_CLASSIFIER: {
    categories: ['正面', '负面', '中性'],
    model: {
      completionParams: {},
      modeId: '',
      mode: 'chat',
    },
    classes: [
      {
        id: 1,
        name: '',
      },
    ],
  },
  IF_ELSE: {
    cases: [],
    output: {},
  },

  CODE: {
    modelId: '',
    context: '',
    system: '',
    variables: [],
    selectOptions: [],
    required: false,
    memory: { windows: 1 },
    code_language: 'python',
    code: '\ndef main(arg1: str, arg2: str) -> dict:\n    return {\n        "result": arg1 + arg2,\n    }\n',
  },
  KNOWLEDGE_RETRIEVAL: {
    label: '知识检索',
    description: '知识库检索节点',
    queryVariableSelector: [],
    required: false,
    memory: { windows: 1 },
    metadataFilter: 'disabled',
    metadataConditions: [{ name: '', value: '', operator: 'IS' }],
    dataset: {
      useAnnotation: false,
      dynamic: false,
      dynamicVariableSelector: [],
      datasets: [],
    },
    output: [
      {
        type: 'Array[Object]',
        name: 'result[]',
        value: '',
        label: '召回分段',
        children: [
          {
            type: 'string',
            name: 'text',
            value: '',
            label: '分段内容',
          },
          {
            type: 'object',
            name: 'metadata',
            value: '',
            label: '元数据',
          },
        ],
      },
    ],
  },
  USER_INPUT: {
    variable: '',
    required: true,
  },
  FILE_UPLOAD: {
    allowedTypes: ['pdf', 'txt', 'doc'],
    maxSize: 10,
  },
  LOOP: {
    maxIterations: 10,
    condition: '',
  },
  VARIABLE_AGGREGATOR: {
    variables: [],
    operation: 'combine',
    output: [
      {
        type: 'Object',
        name: 'result',
        value: '',
        label: '聚合变量',
        children: [],
      },
    ],
  },
  HTTP_REQUEST: {
    method: 'GET',
    url: '',
    timeoutSeconds: 30,
    maxRetries: 0,
    authorization: {
      auth_type: 'none',
      api_key_header: 'Authorization',
      api_key_header_prefix: 'bearer',
      api_key_value: '',
    },
    headers: [{ name: '', value: '' }],
    parameters: [{ name: '', value: '' }],
    bodyType: 'NONE',
    body: {
      NONE: null,
      BINARY: '',
      FORM_DATA: [{ name: '', value: '', type: 'TEXT' }],
      X_WWW_FORM_URLENCODED: [{ name: '', value: '' }],
      JSON: '',
      RAW: '',
    },
    output: [
      { type: 'number', name: 'status', value: 0, label: '响应状态码' },
      { type: 'string', name: 'body', value: '', label: '响应体' },
      { type: 'object', name: 'headers', value: {}, label: '响应头' },
    ],
  },
  SERVICE_API: {
    method: 'GET',
    url: '',
    timeoutSeconds: 30,
    headers: [{ name: '', value: '' }],
    parameters: [{ name: '', value: '' }],
    output: [
      { type: 'number', name: 'status', value: 0, label: '响应状态码' },
      { type: 'string', name: 'body', value: '', label: '响应体' },
    ],
  },
  TEMPLATE_TRANSFORM: {
    template: '',
    variables: [],
  },
  END: {
    output: [],
  },
  ITERATION: {
    iteratorVariableSelector: [],
    outputVariableSelector: [],
    childrenNodes: [],
    parallelSize: 1,
    errorMode: 'terminate',
    output: [
      { type: 'array', name: 'result', value: [], label: '迭代结果' },
    ],
  },
  PARAMETER_EXTRACTOR: {
    parameters: [
      { name: 'param1', type: 'string', description: '', required: false },
    ],
    model: { modelId: '', modelName: '', mode: 'chat', completionParams: {} },
    reasoning_mode: 'function_call',
    inputVariableSelector: [],
    systemPrompt: {
      id: 'prompt_template',
      role: 'system',
      text: '',
    },
    output: [
      { type: 'object', name: 'result', value: {}, label: '抽取结果' },
    ],
  },
  LIST_OPERATOR: {
    inputVariableSelector: [],
    operation: 'filter',
    filterConditions: [],
    mapExpression: '',
    offset: 0,
    limit: 100,
    sortField: '',
    sortOrder: 'asc',
    output: [
      { type: 'array', name: 'result', value: [], label: '结果列表' },
    ],
  },
  DOCUMENT_EXTRACTOR: {
    variableSelector: [],
    extractMode: 'text',
    splitMode: 'none',
    chunkSize: 1000,
    output: [
      { type: 'string', name: 'text', value: '', label: '提取文本' },
    ],
  },
  HUMAN_INPUT: {
    approvalType: 'approve',
    prompt: '请审批以下内容',
    formFields: [],
    timeout: 3600,
    output: [
      { type: 'string', name: 'response', value: '', label: '人工响应' },
      { type: 'boolean', name: 'approved', value: false, label: '是否批准' },
    ],
  },
  VARIABLE_ASSIGNER: {
    assignments: [
      { target: '', source: [], writeMode: 'overwrite' },
    ],
    output: [],
  },
};
export default nodeCardForm;
