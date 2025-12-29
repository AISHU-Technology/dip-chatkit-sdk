import { ChatKitBase, ChatKitBaseProps } from './ChatKitBase';
import {
  ApplicationContext,
  ChatMessage,
  ChatMessageType,
  RoleType,
  OnboardingInfo,
  WebSearchQuery,
  WebSearchResult,
} from '../types';

/**
 * Data Agent 的 AssistantMessage 接口
 * 对应 agent-app.schemas.yaml#/components/schemas/Message
 */
interface AssistantMessage {
  message?: {
    id?: string;
    conversation_id?: string;
    role?: string;
    content?: {
      final_answer?: {
        thinking?: string;
        answer?: {
          text?: string;
        };
      };
      middle_answer?: {
        progress?: Progress[];
      };
    };
  };
  error?: string;
}

/**
 * Progress 接口
 * 智能体执行过程中的一个步骤
 */
interface Progress {
  stage?: string;
  answer?: string;
  skill_info?: {
    name?: string;
    input?: any;
    output?: any;
  };
}

/**
 * EventMessage 接口
 * Data Agent 的 Event Stream Message
 */
interface EventMessage {
  seq_id?: number;
  key?: Array<string | number>;
  action?: 'append' | 'upsert' | 'end';
  content?: any;
}

/**
 * ChatKitDataAgent 组件的属性接口
 */
export interface ChatKitDataAgentProps extends ChatKitBaseProps {
  /** AISHU Data Agent 的 Agent ID,用作路径参数 */
  agentId: string;

  /** 访问令牌,需要包含 Bearer 前缀 (已废弃，请使用 token 属性) */
  bearerToken?: string;

  /** 服务端基础地址,应包含 /api/agent-app/v1 前缀 */
  baseUrl?: string;

  /** agent 版本，"v0"表示最新版本，默认 "v0" */
  agentVersion?: string;

  /** 智能体执行引擎版本，最新为"v2"，默认 "v2" */
  executorVersion?: string;

  /** 智能体所属的业务域,用于 agent-factory API */
  businessDomain?: string;
}

/**
 * ChatKitDataAgent 组件
 * 适配 AISHU Data Agent 平台的智能体对话组件
 * 继承自 ChatKitBase，实现了 generateConversation、sendMessage 和 reduceEventStreamMessage 方法
 */
export class ChatKitDataAgent extends ChatKitBase<ChatKitDataAgentProps> {
  /** 服务端基础地址 */
  private baseUrl: string;

  /** Agent ID */
  private agentId: string;

  /** agent 版本 */
  private agentVersion: string;

  /** 智能体执行引擎版本 */
  private executorVersion: string;

  /** 业务域 */
  private businessDomain: string;

  constructor(props: ChatKitDataAgentProps) {
    super(props);

    this.baseUrl = props.baseUrl || 'https://dip.aishu.cn/api/agent-app/v1';
    this.agentId = props.agentId;
    this.agentVersion = props.agentVersion || 'v0';
    this.executorVersion = props.executorVersion || 'v2';
    this.businessDomain = props.businessDomain || 'bd_public';

    // 向后兼容：如果传入了 bearerToken 但没有 token，从 bearerToken 中提取 token
    if (props.bearerToken && !props.token) {
      // bearerToken 包含 "Bearer " 前缀，需要移除
      this.token = props.bearerToken.replace(/^Bearer\s+/i, '');
    }
  }

  /**
   * 获取开场白和预置问题
   * 调用 AISHU Data Agent 的 agent-factory API 获取智能体配置信息，提取开场白和预置问题
   * API 端点: GET /api/agent-factory/v3/agent-market/agent/{agent_id}/version/v0
   * 注意：该方法是一个无状态无副作用的函数，不允许修改 state
   * @returns 返回开场白信息，包含开场白文案和预置问题
   */
  public async getOnboardingInfo(): Promise<OnboardingInfo> {
    try {
      console.log('正在获取 Data Agent 配置...');

      // 构造 agent-factory API 的完整 URL
      // baseUrl 通常是 https://dip.aishu.cn/api/agent-app/v1 或开发环境的 /data-agent
      // 我们需要替换路径为 /api/agent-factory/v3/agent-market/agent/{agent_id}/version/v0
      let agentFactoryUrl: string;
      if (this.baseUrl.startsWith('http://') || this.baseUrl.startsWith('https://')) {
        // 生产环境：使用完整 URL
        const baseUrlObj = new URL(this.baseUrl);
        agentFactoryUrl = `${baseUrlObj.protocol}//${baseUrlObj.host}/api/agent-factory/v3/agent-market/agent/${encodeURIComponent(this.agentId)}/version/v0`;
      } else {
        // 开发环境：使用相对路径走代理
        agentFactoryUrl = `/api/agent-factory/v3/agent-market/agent/${encodeURIComponent(this.agentId)}/version/v0`;
      }

      console.log('调用 agent-factory API:', agentFactoryUrl);

      // 使用 executeWithTokenRefresh 包装 API 调用，支持 token 刷新和重试
      const result = await this.executeWithTokenRefresh(async () => {
        const response = await fetch(agentFactoryUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'x-business-domain': this.businessDomain,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error: any = new Error(`获取 Data Agent 配置失败: ${response.status} - ${errorText}`);
          error.status = response.status;
          error.body = errorText;
          throw error;
        }

        return await response.json();
      });

      // 从响应中提取开场白和预置问题
      // 根据 agent-factory API 文档,响应格式为: { id, name, config: {...}, ... }
      const config = result.config || {};
      const openingRemarkConfig = config.opening_remark_config || {};
      const presetQuestions = config.preset_questions || [];

      // 构造开场白信息
      let prologue = '你好！我是数据智能体助手，我可以帮你分析数据、回答问题。';
      if (openingRemarkConfig.type === 'fixed' && openingRemarkConfig.fixed_opening_remark) {
        prologue = openingRemarkConfig.fixed_opening_remark;
      }

      // 提取预置问题
      const predefinedQuestions = presetQuestions
        .map((item: any) => item.question)
        .filter((q: any) => typeof q === 'string' && q.trim().length > 0);

      const onboardingInfo: OnboardingInfo = {
        prologue,
        predefinedQuestions,
      };
      return onboardingInfo;
    } catch (error) {
      console.error('获取 Data Agent 配置失败:', error);
      // 返回默认开场白信息
      return {
        prologue: '你好！我是数据智能体助手，我可以帮你分析数据、回答问题。',
        predefinedQuestions: [],
      };
    }
  }

  /**
   * 创建新的会话
   * 调用 Data Agent API 创建新的会话，返回会话 ID
   * API 端点: POST /app/{agent_id}/conversation
   * 注意：该方法是一个无状态无副作用的函数，不允许修改 state
   * @returns 返回新创建的会话 ID
   */
  public async generateConversation(): Promise<string> {
    try {
      console.log('正在创建 Data Agent 会话...');

      // 构造创建会话的请求体
      const requestBody = {
        agent_id: this.agentId,
        agent_version: 'latest',
      };

      // 使用 executeWithTokenRefresh 包装 API 调用，支持 token 刷新和重试
      const result = await this.executeWithTokenRefresh(async () => {
        const response = await fetch(
          `${this.baseUrl}/app/${this.agentId}/conversation`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`,
            },
            body: JSON.stringify(requestBody),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          const error: any = new Error(`创建 Data Agent 会话失败: ${response.status} - ${errorText}`);
          error.status = response.status;
          error.body = errorText;
          throw error;
        }

        return await response.json();
      });
      // 从响应中获取会话 ID
      // 根据 ConversationResponse Schema，响应格式为 { id: string, ttl: string }
      const conversationId = result.data?.id || result.id || '';

      console.log('Data Agent 会话创建成功, conversationID:', conversationId, 'ttl:', result.data?.ttl || result.ttl);
      return conversationId;
    } catch (error) {
      console.error('创建 Data Agent 会话失败:', error);
      // 返回空字符串，允许在没有会话 ID 的情况下继续（API 可能支持自动创建会话）
      return '';
    }
  }

  /**
   * 调用 Data Agent API 发送消息(流式)
   * 注意：该方法是一个无状态无副作用的函数，不允许修改 state
   * @param text 用户输入
   * @param ctx 应用上下文
   * @param conversationID 发送的对话消息所属的会话 ID
   * @returns 返回助手消息
   */
  public async sendMessage(text: string, ctx: ApplicationContext, conversationID?: string): Promise<ChatMessage> {
    if (!this.baseUrl) {
      throw new Error('Data Agent baseUrl 不能为空');
    }

    // 构造上下文信息
    let fullQuery = text;
    if (ctx && ctx.title) {
      fullQuery = `【上下文: ${ctx.title}】\n${JSON.stringify(ctx.data, null, 2)}\n\n${text}`;
    }

    // 构造请求体，使用传入的 conversationID 参数
    const body = {
      agent_id: this.agentId,
      agent_version: this.agentVersion,
      executor_version: this.executorVersion,
      query: fullQuery,
      stream: true,
      custom_querys: ctx?.data,
      conversation_id: conversationID || undefined,
    };

    // 使用 executeWithTokenRefresh 包装 API 调用，支持 token 刷新和重试
    const response = await this.executeWithTokenRefresh(async () => {
      const res = await fetch(
        `${this.baseUrl}/app/${this.agentId}/chat/completion`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${this.token}`,
          },
          body: JSON.stringify(body),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        const error: any = new Error(`Data Agent API 调用失败: ${res.status} ${errText}`);
        error.status = res.status;
        error.body = errText;
        throw error;
      }

      return res;
    });

    const assistantMessageId = `assistant-${Date.now()}`;
    const initialAssistantMessage: ChatMessage = {
      messageId: assistantMessageId,
      content: '',
      type: ChatMessageType.TEXT,
      role: {
        name: 'AI 助手',
        type: RoleType.ASSISTANT,
        avatar: '',
      },
    };

    this.setState((prevState) => ({
      messages: [...prevState.messages, initialAssistantMessage],
      streamingMessageId: assistantMessageId,
    }));

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取流式响应');
    }

    const finalContent = await this.handleStreamResponse(reader, assistantMessageId);

    return {
      ...initialAssistantMessage,
      content: finalContent,
    };
  }

  /**
   * 将 API 接口返回的 EventStream 增量解析成完整的 AssistantMessage 对象
   * 根据设计文档实现白名单机制和 JSONPath 处理
   * @param eventMessage 接收到的一条 Event Message
   * @param prev 上一次增量更新后的 AssistantMessage 对象
   * @returns 返回更新后的 AssistantMessage 对象
   */
  public reduceAssistantMessage<T = any, K = any>(eventMessage: T, prev: K): K {
    try {
      // 解析 EventMessage
      const parsed = typeof eventMessage === 'string' ? JSON.parse(eventMessage) : eventMessage;
      const em = this.parseEventMessage(parsed);

      // 如果 action 是 'end'，直接返回
      if (em.action === 'end') {
        console.log('EventStream 结束');
        return prev;
      }

      // 检查是否在白名单中
      const jsonPath = this.keyToJSONPath(em.key || []);
      const whitelistEntry = this.getWhitelistEntry(em.action || '', jsonPath);

      if (!whitelistEntry) {
        // 不在白名单中，跳过
        console.log('跳过非白名单事件:', em.action, jsonPath);
        return prev;
      }

      // 克隆 prev 对象以避免直接修改
      let assistantMessage: AssistantMessage = JSON.parse(JSON.stringify(prev || {}));

      // 根据 action 处理 content
      if (em.action === 'upsert') {
        assistantMessage = this.applyUpsert(assistantMessage, em.key || [], em.content);
      } else if (em.action === 'append') {
        assistantMessage = this.applyAppend(assistantMessage, em.key || [], em.content);
      }

      // 执行后处理
      if (whitelistEntry.postProcess) {
        whitelistEntry.postProcess(assistantMessage, em.content);
      }

      return assistantMessage as K;
    } catch (e) {
      console.error('解析 Data Agent 事件失败:', e, eventMessage);
      return prev;
    }
  }

  /**
   * 解析原始事件为 EventMessage
   */
  private parseEventMessage(raw: any): EventMessage {
    // 从 SSE data 中提取
    if (raw.data) {
      const dataStr = typeof raw.data === 'string' ? raw.data : JSON.stringify(raw.data);
      try {
        const parsed = JSON.parse(dataStr);
        return {
          seq_id: parsed.seq_id || parsed.seq,
          key: parsed.key,
          action: parsed.action,
          content: parsed.content,
        };
      } catch {
        return raw;
      }
    }

    return {
      seq_id: raw.seq_id || raw.seq,
      key: raw.key,
      action: raw.action,
      content: raw.content,
    };
  }

  /**
   * 将 key 数组转换为 JSONPath 字符串
   * 例如: ["message", "content", "final_answer", "answer", "text"]
   * => "message.content.final_answer.answer.text"
   */
  private keyToJSONPath(key: Array<string | number>): string {
    return key.map((k, index) => {
      if (typeof k === 'number') {
        return `[${k}]`;
      }
      return index === 0 ? k : `.${k}`;
    }).join('').replace(/\.\[/g, '[');
  }

  /**
   * 白名单定义
   * 根据设计文档 3.2 Event Message 白名单
   */
  private getWhitelistEntry(action: string, jsonPath: string): {
    postProcess?: (assistantMessage: AssistantMessage, content: any) => void;
  } | null {
    const entries: { [key: string]: { postProcess?: (assistantMessage: AssistantMessage, content: any) => void } } = {
      'upsert:error': {},
      'upsert:message': {},
      'append:message.content.final_answer.answer.text': {
        postProcess: (assistantMessage) => {
          const text = assistantMessage.message?.content?.final_answer?.answer?.text || '';
          this.appendTextBlock(text);
        },
      },
      'append:message.content.middle_answer.progress': {
        postProcess: (_assistantMessage, content) => {
          // content 是一个 Progress 对象
          if (content?.stage === 'skill') {
            // 检查是否是 Web 搜索工具
            if (content.skill_info?.name === 'zhipu_search_tool') {
              // 构造 WebSearchQuery 并调用渲染方法
              const searchQuery = this.extractWebSearchQuery(content.skill_info);
              if (searchQuery) {
                this.appendWebSearchBlock(searchQuery);
              }
            } else {
              // 其他工具，输出工具名称
              console.log('调用工具:', content.skill_info?.name);
            }
          } else if (content?.stage === 'llm') {
            // LLM 阶段，输出 answer
            const answer = content.answer || '';
            this.appendTextBlock(answer);
          }
        },
      },
    };

    // 对于数组索引的情况，使用正则匹配
    const progressArrayPattern = /^message\.content\.middle_answer\.progress\[\d+\]$/;
    const progressArrayAnswerPattern = /^message\.content\.middle_answer\.progress\[\d+\]\.answer$/;

    if (action === 'append' && progressArrayPattern.test(jsonPath)) {
      return entries['append:message.content.middle_answer.progress'];
    }

    if (action === 'append' && progressArrayAnswerPattern.test(jsonPath)) {
      return {
        postProcess: (assistantMessage) => {
          // 提取最后一个 progress 的 answer
          const progress = assistantMessage.message?.content?.middle_answer?.progress || [];
          if (progress.length > 0) {
            const lastProgress = progress[progress.length - 1];
            const answer = lastProgress.answer || '';
            this.appendTextBlock(answer);
          }
        },
      };
    }

    const key = `${action}:${jsonPath}`;
    return entries[key] || null;
  }

  /**
   * 从 skill_info 中提取 Web 搜索查询
   */
  private extractWebSearchQuery(skillInfo: any): WebSearchQuery | null {
    try {
      const input = skillInfo?.input?.query || skillInfo?.input || '';
      const output = skillInfo?.output;

      if (!output || !Array.isArray(output)) {
        return null;
      }

      const results: WebSearchResult[] = output.map((item: any) => ({
        content: item.content || item.snippet || '',
        icon: item.icon || item.favicon || '',
        link: item.link || item.url || '',
        media: item.media || item.source || '',
        title: item.title || '',
      }));

      return {
        input,
        results,
      };
    } catch (e) {
      console.error('提取 Web 搜索查询失败:', e);
      return null;
    }
  }

  /**
   * 执行 upsert 操作
   * 将 content 赋值到 JSONPath 指定的位置
   */
  private applyUpsert(obj: AssistantMessage, key: Array<string | number>, content: any): AssistantMessage {
    if (key.length === 0) return obj;

    // 使用递归方式设置嵌套属性
    const cloned = { ...obj };
    this.setNestedProperty(cloned, key, content);
    return cloned;
  }

  /**
   * 执行 append 操作
   * 如果 JSONPath 是数组下标，在该位置插入新对象
   * 否则在文本后追加内容
   */
  private applyAppend(obj: AssistantMessage, key: Array<string | number>, content: any): AssistantMessage {
    if (key.length === 0) return obj;

    const cloned = { ...obj };
    const lastKey = key[key.length - 1];

    if (typeof lastKey === 'number') {
      // 数组追加：在指定索引位置插入
      const parentKey = key.slice(0, -1);
      const parent = this.getNestedProperty(cloned, parentKey) as any[];

      if (Array.isArray(parent)) {
        parent[lastKey] = content;
      }
    } else {
      // 文本追加：在现有内容后追加
      const currentValue = this.getNestedProperty(cloned, key);

      if (typeof currentValue === 'string' && typeof content === 'string') {
        this.setNestedProperty(cloned, key, currentValue + content);
      } else {
        this.setNestedProperty(cloned, key, content);
      }
    }

    return cloned;
  }

  /**
   * 获取嵌套属性
   */
  private getNestedProperty(obj: any, key: Array<string | number>): any {
    let current = obj;
    for (const k of key) {
      if (current == null) return undefined;
      current = current[k];
    }
    return current;
  }

  /**
   * 设置嵌套属性
   */
  private setNestedProperty(obj: any, key: Array<string | number>, value: any): void {
    if (key.length === 0) return;

    let current = obj;
    for (let i = 0; i < key.length - 1; i++) {
      const k = key[i];
      const nextKey = key[i + 1];

      if (current[k] == null) {
        // 根据下一个 key 的类型决定创建对象还是数组
        current[k] = typeof nextKey === 'number' ? [] : {};
      }
      current = current[k];
    }

    const lastKey = key[key.length - 1];
    current[lastKey] = value;
  }

  /**
   * 检查是否需要刷新 token
   * AISHU Data Agent 平台返回 401 状态码时表示 token 失效
   * @param status HTTP 状态码
   * @param error 错误响应体
   * @returns 返回是否需要刷新 token
   */
  public shouldRefreshToken(status: number, _error: any): boolean {
    // 401 Unauthorized 表示 token 失效
    return status === 401;
  }
}

export default ChatKitDataAgent;
