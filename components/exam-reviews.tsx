import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, setDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/auth-provider';
import { Star, MessageSquare, Trash2, Edit2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface Review {
  id: string;
  examId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
  updatedAt: any;
}

interface ExamReviewsProps {
  examId: string;
}

export function ExamReviews({ examId }: ExamReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deleteReviewId, setDeleteReviewId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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

  const formRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('examId', '==', examId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: Review[] = [];
      snapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() } as Review);
      });
      // Sort locally to avoid needing a composite index
      results.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });
      setReviews(results);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError('レビューの読み込みに失敗しました。');
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, `reviews?examId=${examId}`);
    });

    return () => unsubscribe();
  }, [examId]);

  const userReview = reviews.find(r => r.userId === user?.uid);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rating === 0) {
      setError('評価（星）を選択してください。');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    const docId = `${user.uid}_${examId}`;
    try {
      if (editingReviewId) {
        await updateDoc(doc(db, 'reviews', editingReviewId), {
          rating,
          comment,
          updatedAt: serverTimestamp()
        });
        setEditingReviewId(null);
      } else {
        await setDoc(doc(db, 'reviews', docId), {
          examId,
          userId: user.uid,
          userName: user.email?.split('@')[0] || '匿名ユーザー',
          rating,
          comment,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setRating(0);
      setComment('');
      showToast(editingReviewId ? 'レビューを更新しました。' : 'レビューを投稿しました！', 'success');
    } catch (err) {
      console.error(err);
      setError('レビューの投稿に失敗しました。');
      handleFirestoreError(err, editingReviewId ? OperationType.UPDATE : OperationType.CREATE, `reviews/${editingReviewId || docId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrigger = (id: string) => {
    setDeleteReviewId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteReviewId) return;
    try {
      await deleteDoc(doc(db, 'reviews', deleteReviewId));
      if (editingReviewId === deleteReviewId) {
        setEditingReviewId(null);
        setRating(0);
        setComment('');
      }
      showToast('レビューを削除しました。', 'success');
    } catch (err) {
      console.error(err);
      setError('レビューの削除に失敗しました。');
      handleFirestoreError(err, OperationType.DELETE, `reviews/${deleteReviewId}`);
    }
  };

  const startEditing = (review: Review) => {
    setEditingReviewId(review.id);
    setRating(review.rating);
    setComment(review.comment);
    
    // Smooth scroll to the form section inside scroll container
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const cancelEdit = () => {
    setEditingReviewId(null);
    setRating(0);
    setComment('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="w-full max-w-3xl mx-auto space-y-8 pb-8 animate-pulse">
        {/* Overview Section Skeleton */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
          <div className="flex flex-col items-center md:items-start space-y-3 w-full md:w-32">
            <div className="h-9 bg-slate-200 dark:bg-slate-800 rounded-xl w-2/3"></div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <div key={s} className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800" />
              ))}
            </div>
            <div className="h-4 bg-slate-100 dark:bg-slate-800/50 rounded w-1/2"></div>
          </div>
        </div>

        {/* Comment Form Skeleton */}
        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/6"></div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <div key={s} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800" />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12"></div>
              <div className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl"></div>
            </div>
          </div>
        </div>

        {/* Reviews List Skeleton */}
        <div className="space-y-4">
          <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded w-1/4 mb-4 ml-2"></div>
          {[1, 2].map((i) => (
            <div key={i} className="p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                <div className="flex items-center gap-3 w-full">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full shrink-0"></div>
                  <div className="space-y-2 w-1/2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-1/4"></div>
                  </div>
                </div>
                <div className="flex gap-0.5 mt-2 sm:mt-0">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800" />
                  ))}
                </div>
              </div>
              <div className="space-y-2 pt-2">
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-[90%]"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const avgRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-8">
      {/* Overview Section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col md:flex-row items-center gap-6 shadow-sm">
        <div className="text-center md:text-left flex flex-col items-center md:items-start">
          <div className="text-4xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {avgRating} <span className="text-xl font-medium text-slate-400">/ 5</span>
          </div>
          <div className="flex gap-1 mt-2 text-amber-400">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star key={star} className={`w-5 h-5 ${star <= Number(avgRating) ? 'fill-current' : 'text-slate-200 dark:text-slate-700'}`} />
            ))}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{reviews.length} 件のレビュー</p>
        </div>
      </div>

      {/* Form Section */}
      <div ref={formRef} className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 scroll-mt-6">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          {editingReviewId ? 'レビューを編集' : (userReview ? 'あなたのレビューを追加済み' : 'レビュー・コメントを投稿')}
        </h3>

        {(!userReview || editingReviewId) ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">評価 (1-5)</label>
              <div className="flex gap-1 cursor-pointer">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-sm"
                  >
                    <Star 
                      className={`w-8 h-8 transition-colors ${star <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-200 dark:hover:text-amber-700'}`} 
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">コメント</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="この過去問の難易度や、どのような点が役立ったかなどを共有してください"
                className="w-full min-h-[100px] border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow resize-y"
              />
            </div>

            <div className="flex gap-2 justify-end">
              {editingReviewId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                >
                  キャンセル
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting || rating === 0}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-sm font-bold shadow-sm transition-colors"
              >
                {isSubmitting ? '送信中...' : (editingReviewId ? '更新する' : '投稿する')}
              </button>
            </div>
          </form>
        ) : (
          <div className="text-sm text-slate-600 dark:text-slate-400">
            あなたはすでにこの過去問にレビューを投稿しています。下のリストから編集・削除が可能です。
          </div>
        )}
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-4 px-2">みんなのレビュー</h3>
        {reviews.length === 0 ? (
          <div className="py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-slate-500 dark:text-slate-400">
            まだレビューはありません。最初のレビューを投稿してみましょう。
          </div>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className={`p-4 sm:p-6 bg-white dark:bg-slate-900 rounded-2xl border ${r.userId === user?.uid ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/30 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-800'}`}>
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 uppercase shrink-0">
                    {r.userName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      {r.userName}
                      {r.userId === user?.uid && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">あなた</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                       {r.createdAt ? formatDistanceToNow(r.createdAt.toDate(), { addSuffix: true, locale: ja }) : 'たった今'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:self-center">
                  <div className="flex gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star key={star} className={`w-4 h-4 ${star <= r.rating ? 'fill-current' : 'text-slate-200 dark:text-slate-800'}`} />
                    ))}
                  </div>
                </div>
              </div>

              {r.comment && (
                <div className="mt-4 text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                  {r.comment}
                </div>
              )}

              {r.userId === user?.uid && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                  <button 
                    onClick={() => startEditing(r)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> 編集
                  </button>
                  <button 
                    onClick={() => handleDeleteTrigger(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 削除
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
          {toast.type === 'success' && <Star className="w-5 h-5 text-emerald-500 shrink-0 fill-current" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Confirm Modal */}
      {deleteReviewId && (
        <ConfirmModal
          title="レビューを削除しますか？"
          description="この操作は取り消せません。"
          confirmText="削除する"
          cancelText="キャンセル"
          variant="danger"
          onClose={() => setDeleteReviewId(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}
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
            {loading ? <Star className="w-4.5 h-4.5 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
