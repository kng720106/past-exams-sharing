export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">ページが見つかりません</h2>
        <p className="text-slate-500 mb-4">お探しのページは存在しないか、移動しました。</p>
        <a href="/" className="text-indigo-600 hover:underline">トップページに戻る</a>
      </div>
    </div>
  );
}
