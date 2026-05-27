'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, getDoc, updateDoc, increment, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { FileText, FileImage, Clock, Download, Share2, Flag, Eye, Lock, Trash2, X, AlertCircle, CheckCircle, Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { useAuth } from '@/components/auth-provider';
import { ExamPreviewModal } from './exam-preview-modal';

interface Exam {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  bandai: number;
  category: string;
  instructor: string;
  year: number;
  type: 'pdf' | 'image';
  fileUrl: string;
  authorId: string;
  downloadsCount: number;
  reportsCount: number;
  createdAt: any;
  updatedAt: any;
}

interface ExamFeedProps {
  bandaiFilter?: number | '';
  categoryFilter?: string;
  courseIdFilter?: string;
  keywordFilter?: string;
  authorFilter?: string;
  downloadedOnly?: boolean;
  courses?: any[];
}

export function ExamFeed({ bandaiFilter, categoryFilter, courseIdFilter, keywordFilter, authorFilter, downloadedOnly, courses = [] }: ExamFeedProps) {
  const { user, userData } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadLimit, setLoadLimit] = useState(50);
  const [hasMore, setHasMore] = useState(true);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [reportExam, setReportExam] = useState<Exam | null>(null);
  const [deleteExam, setDeleteExam] = useState<Exam | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const constraints: any[] = [];
    if (courseIdFilter) {
      constraints.push(where('courseId', '==', courseIdFilter));
    } else if (categoryFilter) {
       // Cannot do equality on both if we only have single composite indexes defined, so use else if
      constraints.push(where('category', '==', categoryFilter));
    } else if (authorFilter) {
      constraints.push(where('authorId', '==', authorFilter));
    }
    
    constraints.push(orderBy('createdAt', 'desc'));
    constraints.push(limit(loadLimit));
    
    const q = query(collection(db, 'exams'), ...constraints);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const examsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Exam[];
      
      let filtered = examsData;
      // Filter out heavily reported exams for safety, unless the user is the author
      filtered = filtered.filter(e => (e.reportsCount || 0) < 3 || e.authorId === user?.uid);
      
      if (bandaiFilter !== undefined && bandaiFilter !== '') {
        const bandaiValue = typeof bandaiFilter === 'string' ? parseInt(bandaiFilter) : bandaiFilter;
        if (!isNaN(bandaiValue)) {
           filtered = filtered.filter(e => e.bandai >= bandaiValue && e.bandai < bandaiValue + 100);
        }
      }
      if (categoryFilter && categoryFilter !== '') {
        filtered = filtered.filter(e => e.category === categoryFilter);
      }
      if (courseIdFilter && courseIdFilter !== '') {
        filtered = filtered.filter(e => e.courseId === courseIdFilter);
      }
      if (authorFilter) {
        filtered = filtered.filter(e => e.authorId === authorFilter);
      }
      if (downloadedOnly) {
        filtered = filtered.filter(e => userData?.downloadedExams?.includes(e.id));
      }
      if (keywordFilter) {
        const lowerKey = keywordFilter.toLowerCase();
        filtered = filtered.filter(e => {
          const course = courses.find(c => c.id === e.courseId);
          return (
            (e.title && e.title.toLowerCase().includes(lowerKey)) || 
            (e.courseName && e.courseName.toLowerCase().includes(lowerKey)) || 
            (e.instructor && e.instructor.toLowerCase().includes(lowerKey)) ||
            (e.category && e.category.toLowerCase().includes(lowerKey)) ||
            (e.bandai && e.bandai.toString().includes(lowerKey)) ||
            (course && course.courseCode && course.courseCode.toLowerCase().includes(lowerKey)) ||
            (course && course.term && course.term.toLowerCase().includes(lowerKey))
          );
        });
      }
      
      setHasMore(snapshot.docs.length >= loadLimit);
      setExams(filtered);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exams');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [bandaiFilter, categoryFilter, courseIdFilter, keywordFilter, authorFilter, loadLimit, downloadedOnly]);

  const [previewExam, setPreviewExam] = useState<Exam | null>(null);

  const handleCardClick = (exam: Exam) => {
    setPreviewExam(exam);
  };

  const handleUnlock = async (exam: Exam) => {
    if (!user || !userData || isUnlocking) return;
    
    setIsUnlocking(true);
    try {
       const userRef = doc(db, 'users', user.uid);
       const downloadRef = doc(db, 'exams', exam.id, 'downloads', user.uid);
       const examRef = doc(db, 'exams', exam.id);

       const { runTransaction, arrayUnion } = await import('firebase/firestore');

       await runTransaction(db, async (transaction) => {
           const downloadDoc = await transaction.get(downloadRef);
           if (!downloadDoc.exists()) {
               const userDoc = await transaction.get(userRef);
               if (!userDoc.exists()) throw new Error('User not found');
               
               const currentUserPts = userDoc.data().points || 0;
               if (currentUserPts < 5) {
                   throw new Error('INSUFFICIENT_POINTS');
               }

               transaction.update(userRef, {
                 points: increment(-5),
                 downloadedExams: arrayUnion(exam.id),
                 lastDownloadExamId: exam.id,
                 updatedAt: serverTimestamp()
               });
               
               transaction.update(examRef, {
                 downloadsCount: increment(1),
                 updatedAt: serverTimestamp()
               });
               
               transaction.set(downloadRef, {
                 userId: user.uid,
                 downloadedAt: serverTimestamp()
               });
           }
       });
       
       // Handle the case where user already had it but wasn't in array
       const downloadDocPost = await getDoc(downloadRef);
       if (downloadDocPost.exists() && !userData.downloadedExams?.includes(exam.id)) {
           const { updateDoc, arrayUnion: arrUnion2 } = await import('firebase/firestore');
           updateDoc(userRef, {
               downloadedExams: arrUnion2(exam.id),
               updatedAt: serverTimestamp()
           }).catch(console.error);
       }
    } catch (e: any) {
       console.error(e);
       if (e.message === 'INSUFFICIENT_POINTS') {
         showToast('ポイントが不足しています。新しく過去問をアップロードしてポイントを獲得してください！（必要: 5pt）', 'error');
       } else {
         showToast('エラーが発生しました: ' + e.message, 'error');
       }
    } finally {
       setIsUnlocking(false);
    }
  };

  const handleReportTrigger = (e: React.MouseEvent, exam: Exam) => {
    e.stopPropagation();
    if (!user || user.uid === exam.authorId) return;
    setReportExam(exam);
  };

  const handleReportSubmit = async (reason: string) => {
    if (!reportExam || !user) return;

    try {
      const { writeBatch } = await import('firebase/firestore');
      const batch = writeBatch(db);
      
      const reportId = `${reportExam.id}_${user.uid}`;
      const reportRef = doc(db, 'reports', reportId);
      
      let reportDoc;
      try {
        reportDoc = await getDoc(reportRef);
      } catch (getErr) {
        handleFirestoreError(getErr, OperationType.GET, `reports/${reportId}`);
      }
      
      if (reportDoc && reportDoc.exists()) {
         showToast('すでにこの過去問を通報済みです。', 'error');
         return;
      }
      
      batch.set(reportRef, {
        examId: reportExam.id,
        reporterId: user.uid,
        reason: reason.substring(0, 500),
        status: 'pending',
        createdAt: serverTimestamp()
      });
      
      const examRef = doc(db, 'exams', reportExam.id);
      batch.update(examRef, {
        reportsCount: increment(1),
        lastReportId: reportId,
        updatedAt: serverTimestamp()
      });
      
      try {
        await batch.commit();
      } catch (commitErr) {
        handleFirestoreError(commitErr, OperationType.WRITE, `reports/${reportId}`);
      }
      showToast('通報が完了しました。ご報告ありがとうございます。管理者が確認いたします。', 'success');
    } catch (e: any) {
      console.error("Report limit/error:", e);
      showToast('通報処理に失敗しました。', 'error');
    }
  };

  const handleDeleteTrigger = (e: React.MouseEvent, exam: Exam) => {
    e.stopPropagation();
    setDeleteExam(exam);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteExam) return;

    try {
      // 1. Fetch fileURL from secure subcollection
      const secureDoc = await getDoc(doc(db, 'exams', deleteExam.id, 'secure', 'data'));
      if (secureDoc.exists() && secureDoc.data().fileUrl) {
        // 2. Delete file from Storage
        const fileRef = ref(storage, secureDoc.data().fileUrl);
        try {
          await deleteObject(fileRef);
        } catch (storageError) {
          console.error("Storage delete error:", storageError);
        }
      }

      // 3. Cascade delete: secure data
      try { await deleteDoc(doc(db, 'exams', deleteExam.id, 'secure', 'data')); } catch (e) {}

      // 4. Cascade delete: downloads
      try {
        const { getDocs } = await import('firebase/firestore');
        const downloadsSnap = await getDocs(collection(db, 'exams', deleteExam.id, 'downloads'));
        for (const d of downloadsSnap.docs) {
           await deleteDoc(doc(db, 'exams', deleteExam.id, 'downloads', d.id));
        }
      } catch (e) {}

      // 5. Cascade delete: reports
      try {
        const { getDocs, query, where } = await import('firebase/firestore');
        const reportsSnap = await getDocs(query(collection(db, 'reports'), where('examId', '==', deleteExam.id)));
        for (const r of reportsSnap.docs) {
           await deleteDoc(doc(db, 'reports', r.id));
        }
      } catch (e) {}

      // 5.5 Cascade delete: reviews
      try {
        const { getDocs, query, where } = await import('firebase/firestore');
        const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('examId', '==', deleteExam.id)));
        for (const r of reviewsSnap.docs) {
           await deleteDoc(doc(db, 'reviews', r.id));
        }
      } catch (e) {}

      // 6. Delete document from Firestore
      await deleteDoc(doc(db, 'exams', deleteExam.id));
      showToast('投稿と関連データをすべて削除しました。', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('削除処理中にエラーが発生しました。一部のデータが残っている可能性があります。', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex animate-pulse space-x-4 p-4">
         <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded"></div>
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-5/6"></div>
            </div>
         </div>
      </div>
    );
  }

  if (exams.length === 0) {
    if (downloadedOnly) {
      return (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center transition-colors">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl flex items-center justify-center text-indigo-400 dark:text-indigo-300 mb-4 transform -rotate-6">
             <Download className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">ダウンロード履歴がありません</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
            過去問をダウンロードすると、ここからすぐにアクセスできるようになります。
          </p>
        </div>
      );
    }
    return (
      <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col items-center justify-center transition-colors">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800/50 rounded-2xl flex items-center justify-center text-indigo-400 dark:text-indigo-300 mb-4 transform -rotate-6">
           <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">まだ過去問がありません</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
          条件に一致する過去問が見つかりませんでした。あなたが最初のアップロード者になって、後輩たちを助けませんか？
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {exams.map(exam => {
        const isAuthor = user?.uid === exam.authorId;
        const isDownloaded = Boolean(userData?.downloadedExams?.includes(exam.id));
        const canAfford = isAuthor || isDownloaded || (userData?.points ?? 0) >= 5;

        return (
          <div 
            key={exam.id} 
            onClick={() => handleCardClick(exam)}
            className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-start justify-between hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex items-start space-x-4">
               <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                 exam.type === 'pdf' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
               }`}>
                  {exam.type === 'pdf' ? <FileText className="w-6 h-6" /> : <FileImage className="w-6 h-6" />}
               </div>
               <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-lg mb-1 leading-tight flex items-center flex-wrap gap-2">
                    {exam.title}
                    {isAuthor && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        自分がアップロード
                      </span>
                    )}
                    {!isAuthor && !isDownloaded && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        5 pt
                      </span>
                    )}
                    {!isAuthor && isDownloaded && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800">
                        ロック解除済
                      </span>
                    )}
                  </h3>
                  <div className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
                     <span className="font-medium text-slate-700 dark:text-slate-300">{exam.courseName}</span>
                     {exam.category && (
                       <>
                         <span className="text-slate-300 dark:text-slate-600">•</span>
                         <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded text-xs">{exam.category}</span>
                       </>
                     )}
                     {exam.instructor && (
                       <>
                         <span className="text-slate-300 dark:text-slate-600">•</span>
                         <span>{exam.instructor}</span>
                       </>
                     )}
                     {exam.year && (
                       <>
                         <span className="text-slate-300 dark:text-slate-600">•</span>
                         <span>{exam.year}年度</span>
                       </>
                     )}
                  </div>
                  
                  <div className="flex items-center space-x-4 mt-3">
                    <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center space-x-1">
                       <Clock className="w-3.5 h-3.5" />
                       <span>
                         {exam.createdAt?.toDate 
                           ? formatDistanceToNow(exam.createdAt.toDate(), { addSuffix: true, locale: ja }) 
                           : '最近'}
                       </span>
                    </div>
                  </div>
               </div>
            </div>
            <div className="flex flex-col items-end space-y-2 shrink-0 h-full justify-between">
               <button className={`p-2 rounded-lg transition-colors ${canAfford ? 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30' : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title="ダウンロード / 開く">
                  {isAuthor || isDownloaded ? <Eye className="w-5 h-5" /> : (canAfford ? <Download className="w-5 h-5" /> : <Lock className="w-5 h-5" />)}
               </button>
               {isAuthor ? (
                 <button 
                   className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors mt-auto" 
                   title="削除する" 
                   onClick={(e) => handleDeleteTrigger(e, exam)}
                 >
                    <Trash2 className="w-4 h-4" />
                 </button>
               ) : (
                 <button 
                   className="p-2 text-slate-400 dark:text-slate-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/20 rounded-lg transition-colors mt-auto" 
                   title="通報する" 
                   onClick={(e) => handleReportTrigger(e, exam)}
                 >
                    <Flag className="w-4 h-4" />
                 </button>
               )}
            </div>
          </div>
        );
      })}
      
      {hasMore && (
        <div className="flex justify-center pt-6 pb-4">
          <button 
            onClick={() => setLoadLimit(prev => prev + 50)}
            className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            もっと見る
          </button>
        </div>
      )}

      {previewExam && (
        <ExamPreviewModal
           exam={previewExam}
           isUnlocked={Boolean(previewExam.authorId === user?.uid || userData?.downloadedExams?.includes(previewExam.id))}
           onClose={() => setPreviewExam(null)}
           onUnlock={() => handleUnlock(previewExam)}
           userPoints={userData?.points || 0}
           isUnlocking={isUnlocking}
        />
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          id="custom-toast"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border animate-in fade-in slide-in-from-top-4 duration-300 ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/90 dark:text-emerald-300 dark:border-emerald-800' 
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/90 dark:text-rose-300 dark:border-rose-800'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/90 dark:text-indigo-300 dark:border-indigo-800'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
          {toast.type === 'info' && <MessageSquare className="w-5 h-5 text-indigo-500 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Report Modal */}
      {reportExam && (
        <ReportModal
          exam={reportExam}
          onClose={() => setReportExam(null)}
          onSubmit={handleReportSubmit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteExam && (
        <ConfirmModal
          title="投稿を削除しますか？"
          description="この操作は取り消せません。関連するファイルやレポートもすべて削除されます。"
          confirmText="削除する"
          cancelText="キャンセル"
          variant="danger"
          onClose={() => setDeleteExam(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}

interface ReportModalProps {
  exam: any;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

function ReportModal({ exam, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    await onSubmit(reason);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span className="p-1.5 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </span>
            通報する
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            「<span className="font-semibold text-slate-700 dark:text-slate-300">{exam.title}</span>」に対する通報理由を入力してください。
          </p>
          
          <div>
            <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">通報理由</label>
            <textarea
              required
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="スパム、不適切な内容、無効なファイル、またはその他の不適切な行為..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 disabled:bg-rose-800/50 disabled:cursor-not-allowed cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  送信中...
                </>
              ) : '送信する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ConfirmModalProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  variant?: 'danger' | 'info';
}

function ConfirmModal({ title, description, confirmText = '確認', cancelText = 'キャンセル', onClose, onConfirm, variant = 'info' }: ConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await onConfirm();
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <span className={`p-1.5 rounded-lg shrink-0 ${variant === 'danger' ? 'bg-rose-50 dark:bg-rose-950/35 text-rose-600' : 'bg-indigo-50 dark:bg-indigo-950/35 text-indigo-600'}`}>
            <AlertCircle className="w-5 h-5" />
          </span>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        </div>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {description}
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 cursor-pointer ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 disabled:bg-rose-800/50'
                : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800/50'
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

