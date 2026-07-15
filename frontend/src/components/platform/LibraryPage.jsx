// 文件库页。纯机械从 platform-app.jsx 搬出,零行为变化。
import React from 'react';
import FileLibrary from '../FileLibrary.jsx';

function LibraryPage() {
  // W3-C2: 文件库 — 只读管理(列表/查看/下载/删除带关联警告)
  return <FileLibrary />;
}

export { LibraryPage };
