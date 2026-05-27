import React, { useState, useEffect } from 'react';
import { X, Lock, FileText, FileImage, Download, AlertCircle, MessageSquare, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ExamReviews } from './exam-reviews';
import Image from 'next/image';

interface ExamPreviewModalProps {
  exam: any;
  isUnlocked: boolean;
  onClose: () => void;
  onUnlock: () => void;
  userPoints: number;
  isUnlocking?: boolean;
}

export function ExamPreviewModal({ exam, isUnlocked, onClose, onUnlock, userPoints, isUnlocking = false }: ExamPreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'reviews'>('preview');

  useEffect(() => {
    if (isUnlocked) {
      const fetchFileUrl = async () => {
        setLoadingFile(true);
        try {
          const docSnap = await getDoc(doc(db, 'exams', exam.id, 'secure', 'data'));
          if (docSnap.exists() && docSnap.data().fileUrl) {
            setFileUrl(docSnap.data().fileUrl);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setLoadingFile(false);
        }
      };
      fetchFileUrl();
    }
  }, [isUnlocked, exam.id]);

  const handleDownloadClick = () => {
    if (fileUrl) {
      window.open(fileUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm pointer-events-auto">
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl relative z-10 scale-100 transition-all border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 transition-colors">
          <div className="p-4 md:p-6 flex justify-between items-start">
             <div>
               <h2 className="text-xl md:text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                 {exam.type === 'pdf' ? <FileText className="w-6 h-6 text-red-500 dark:text-red-400" /> : <FileImage className="w-6 h-6 text-orange-500 dark:text-orange-400" />}
                 {exam.title}
               </h2>
               <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center mt-2 gap-x-3 gap-y-1">
                   <span className="font-medium text-slate-700 dark:text-slate-300">{exam.courseName}</span>
                   {exam.instructor && <span>• {exam.instructor}</span>}
                   {exam.year && <span>• {exam.year}年度</span>}
               </div>
             </div>
             <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-full transition-colors shrink-0">
               <X className="w-5 h-5" />
             </button>
          </div>
          <div className="flex px-4 md:px-6 gap-6">
            <button
              onClick={() => setActiveTab('preview')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 ${activeTab === 'preview' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              プレビュー
            </button>
            <button
              onClick={() => setActiveTab('reviews')}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'reviews' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
            >
              <MessageSquare className="w-4 h-4" />
              レビューとコメント
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-100/50 dark:bg-slate-950/50 p-4 md:p-6 flex flex-col min-h-[300px]">
           {activeTab === 'preview' ? (
             isUnlocked ? (
               loadingFile ? (
                 exam.type === 'pdf' ? (
                   <div className="w-full h-full min-h-[500px] border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900/50 p-8 flex flex-col gap-6 animate-pulse shadow-sm">
                     {/* Mock Page Header */}
                     <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/80 pb-4">
                       <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4"></div>
                       <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-12"></div>
                     </div>
                     {/* Mock Content Blocks */}
                     <div className="space-y-4 flex-1">
                       <div className="h-7 bg-slate-300 dark:bg-slate-700 rounded w-2/3 mb-6"></div>
                       <div className="space-y-3">
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[95%]"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[85%]"></div>
                       </div>
                       <div className="pt-6 space-y-3">
                         <div className="h-5 bg-slate-300 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[90%] font-semibold"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[92%]"></div>
                         <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-[60%]"></div>
                       </div>
                     </div>
                     {/* Loading indicator floating in the center of the skeleton */}
                     <div className="flex items-center justify-center gap-2 py-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 self-center px-4 shadow-sm">
                       <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                       <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">PDFドキュメントを読み込み中...</span>
                     </div>
                   </div>
                 ) : (
                   <div className="relative w-full h-[60vh] max-h-[60vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex flex-col items-center justify-center gap-4 animate-pulse shadow-sm">
                     <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-700">
                       <FileImage className="w-8 h-8" />
                     </div>
                     <div className="flex items-center gap-2">
                       <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                       <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">画像を読み込み中...</span>
                     </div>
                   </div>
                 )
             ) : fileUrl ? (
               exam.type === 'pdf' ? (
                  <iframe src={`${fileUrl}#view=FitH`} className="w-full h-full min-h-[500px] border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-sm" title="PDF Preview" />
               ) : (
                  <div className="relative w-full h-[60vh] max-h-[60vh]">
                    <Image 
                      src={fileUrl} 
                      alt="Preview" 
                      fill 
                      referrerPolicy="no-referrer"
                      className="object-contain rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" 
                    />
                  </div>
               )
             ) : (
               <div className="text-slate-500 dark:text-slate-400 text-center flex flex-col items-center gap-2">
                 <AlertCircle className="w-8 h-8 text-rose-400 dark:text-rose-500" />
                 ファイルの取得に失敗しました。<br />削除されたか存在しない可能性があります。
               </div>
             )
           ) : (
             <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col items-center p-8 text-center relative transition-colors">
                 <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 dark:from-slate-900 dark:via-slate-900/80 to-transparent z-10 flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4 text-slate-400 shadow-inner">
                      <Lock className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">プレビューがロックされています</h3>
                    <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm flex flex-col">
                      <span>この過去問を閲覧・ダウンロードするには</span>
                      <span><span className="font-bold text-indigo-600">5 pt</span> が必要です。</span>
                      <span className="text-xs text-slate-400 mt-2">※一度ロックを解除するといつでも閲覧可能になります。</span>
                    </p>
                    
                    <button 
                      onClick={onUnlock}
                      disabled={userPoints < 5 || isUnlocking}
                      className="w-full sm:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      {isUnlocking ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          処理中...
                        </>
                      ) : '5 pt 消費してロック解除'}
                    </button>

                    {userPoints < 5 && (
                      <p className="mt-4 text-xs text-rose-500 font-medium">ポイントが不足しています。過去問を投稿してポイントを獲得してください。</p>
                    )}
                 </div>
                 
                 {/* Blurred dummy background mimicking a document */}
                 <div className="w-full aspect-[1/1.4] bg-slate-50 dark:bg-slate-950/40 rounded border border-slate-100 dark:border-slate-800 p-8 flex flex-col gap-4 opacity-40 blur-[4px] select-none">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-2/3 mb-4"></div>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className={`h-3 bg-slate-200 dark:bg-slate-800 rounded ${i % 3 === 0 ? 'w-[90%]' : i % 2 === 0 ? 'w-full' : 'w-[80%]'}`}></div>
                    ))}
                 </div>
             </div>
           )
         ) : (
           <ExamReviews examId={exam.id} />
         )}
        </div>

        {/* Footer actions for unlocked state */}
        {activeTab === 'preview' && isUnlocked && fileUrl && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center sm:px-6 transition-colors">
             <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
               {exam.tags?.length > 0 && `タグ: ${exam.tags.join(', ')}`}
             </div>
             <button 
               onClick={handleDownloadClick}
               className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
             >
               <Download className="w-4 h-4" /> 新しいタブで開く (ダウンロード)
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
