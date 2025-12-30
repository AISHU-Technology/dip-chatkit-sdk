import React, { useState } from 'react';
import { WebSearchBlock } from '../../types';

/**
 * WebSearchBlockComponent 组件的属性接口
 */
export interface WebSearchBlockComponentProps {
  /** Web 搜索块数据 */
  block: WebSearchBlock;
}

/**
 * WebSearchBlockComponent 组件
 * 用于渲染 Web 搜索类型的消息块
 */
const WebSearchBlockComponent: React.FC<WebSearchBlockComponentProps> = ({ block }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { input, results } = block.content;

  return (
    <div className="web-search-block border border-gray-200 rounded-lg p-4 my-2 bg-gray-50">
      {/* 搜索查询标题 */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <span className="font-medium text-gray-700">Web 搜索</span>
          <span className="text-sm text-gray-500">"{input}"</span>
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {/* 搜索结果列表 */}
      {isExpanded && results.length > 0 && (
        <div className="mt-4 space-y-3">
          {results.map((result, index) => (
            <a
              key={index}
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                {/* 网站图标 */}
                {result.icon && (
                  <img
                    src={result.icon}
                    alt={result.media}
                    className="w-5 h-5 mt-1 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}

                <div className="flex-1 min-w-0">
                  {/* 来源网站名称 */}
                  {result.media && (
                    <div className="text-xs text-gray-500 mb-1">
                      {result.media}
                    </div>
                  )}

                  {/* 文章标题 */}
                  <div className="text-sm font-medium text-blue-600 hover:underline mb-1">
                    {result.title}
                  </div>

                  {/* 内容摘要 */}
                  {result.content && (
                    <div className="text-sm text-gray-600 line-clamp-2">
                      {result.content}
                    </div>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebSearchBlockComponent;
