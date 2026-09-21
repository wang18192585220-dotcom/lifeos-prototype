'use strict';

/**
 * 文本切片与索引预处理（README 8.1）。
 *
 * - 切片：默认约 1000 字符、重叠 150 字符，避免切断短练习。
 * - 中文：字符 bigram（如「你好世界」→「你好 好世 世界」），使 FTS5 能匹配中文子串。
 * - 西班牙语：重音/大小写由 FTS5 unicode61 remove_diacritics 处理。
 */

function chunkText(text, { size = 1000, overlap = 150 } = {}) {
  if (typeof text !== 'string' || text.length === 0) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

/** 对中文连续片段做 bigram 展开，供 FTS5 索引与查询。 */
function bigramCJK(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[\u4e00-\u9fff]+/g, (run) => {
    if (run.length === 1) return run;
    const grams = [];
    for (let i = 0; i < run.length - 1; i++) grams.push(run.slice(i, i + 2));
    return grams.join(' ');
  });
}

module.exports = { chunkText, bigramCJK };
