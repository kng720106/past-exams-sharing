'use client';

import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { useAuth } from '@/components/auth-provider';
import { Plus, MessageSquare, Trash2, CheckCircle, X, Loader2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';

interface RequestModel {
  id: string;
  title: string;
  courseName: string;
  professor: string;
  description: string;
  authorId: string;
  status: 'open' | 'fulfilled' | 'closed';
  createdAt: any;
  updatedAt: any;
}

interface RequestBoardProps {
  authorFilter?: string;
  courses?: any[];
  hideForm?: boolean;
  onRequestClick?: (req: RequestModel) => void;
}

export function RequestBoard({ authorFilter, courses = [], hideForm = false, onRequestClick }: RequestBoardProps) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);

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
  const [courseName, setCourseName] = useState('');
  const [professor, setProfessor] = useState('');
  const [description, setDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RequestModel[];
      
      if (authorFilter) {
        data = data.filter(r => r.authorId === authorFilter);
      }
      
      setRequests(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'requests');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isSubmitting) return;
    if (!title || !description || !selectedCourseId) {
      showToast('タイトル、講義、詳細は必須です', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const requestId = uuidv4();
      await setDoc(doc(db, 'requests', requestId), {
        title,
        courseName,
        professor,
        description,
        authorId: user.uid,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      setIsModalOpen(false);
      setTitle('');
      setCourseName('');
      setProfessor('');
      setDescription('');
      setSelectedCourseId('');
      setSearchTerm('');
      showToast('リクエストを投稿しました！', 'success');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.CREATE, 'requests');
      showToast('投稿に失敗しました。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrigger = (id: string) => {
    setDeleteRequestId(id);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteRequestId) return;
    try {
      await deleteDoc(doc(db, 'requests', deleteRequestId));
      showToast('リクエストを削除しました。', 'success');
    } catch (error: any) {
      console.error(error);
      showToast('削除に失敗しました。', 'error');
    }
  };

  if (loading) {
    return <div className="animate-pulse space-y-4">
      <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
      <div className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
    </div>;
  }

  return (
    <div className="space-y-6">
      {!hideForm && (
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
            リクエスト掲示板
          </h2>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition"
          >
            <Plus className="w-4 h-4 mr-1" />
            新しくリクエスト
          </button>
        </div>
      )}

      <div className="space-y-4">
        {requests.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 transition-colors">
            まだリクエストはありません。
          </div>
        ) : (
          requests.map(req => (
            <div 
              key={req.id} 
              className={`bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 relative group transition-colors ${onRequestClick ? 'cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md' : 'hover:border-indigo-300 dark:hover:border-indigo-600'}`}
              onClick={() => {
                if (onRequestClick) onRequestClick(req);
              }}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-lg leading-tight pr-8">{req.title}</h3>
                <div className="flex items-center gap-2">
                  {req.status === 'open' ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">募集中</span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">解決済み</span>
                  )}
                  {user?.uid === req.authorId && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteTrigger(req.id);
                      }}
                      className="p-1.5 text-slate-300 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition"
                      title="リクエストを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="text-sm text-slate-600 dark:text-slate-300 mb-3 whitespace-pre-wrap">{req.description}</div>
              
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                {req.courseName && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{req.courseName}</span>
                )}
                {req.professor && (
                  <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">{req.professor}教授</span>
                )}
                <span className="ml-auto flex items-center">
                  {req.createdAt?.toDate ? formatDistanceToNow(req.createdAt.toDate(), { locale: ja, addSuffix: true }) : '最近'}
                </span>
              </div>
              
              {onRequestClick && (
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end text-sm font-medium text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                   このリクエストに過去問を投稿する
                   <Plus className="w-4 h-4 ml-1" />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200 transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">資料をリクエスト</h3>
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="閉じる"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">タイトル <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="例: マクロ経済学の2023年中間の過去問"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">講義を選択 <span className="text-red-500">*</span></label>
                {selectedCourseId ? (
                  <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg transition-colors">
                    <div>
                      <div className="font-semibold text-indigo-900 dark:text-indigo-200">{courseName}</div>
                      <div className="text-xs text-indigo-700 dark:text-indigo-450">
                        {professor}
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => {
                        setSelectedCourseId('');
                        setCourseName('');
                        setProfessor('');
                      }} 
                      className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-950/40 rounded text-indigo-500 dark:text-indigo-400 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={e => {
                        setSearchTerm(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                      placeholder="講義名、担当教員、科目コードで検索"
                      required
                      className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 rounded-lg outline-none transition-shadow text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
                    />
                    
                    {isDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {courses.filter(c => 
                          searchTerm.trim() === '' ||
                          (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
                          (c.instructor && c.instructor.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.courseCode && c.courseCode.toLowerCase().includes(searchTerm.toLowerCase()))
                        ).slice(0, 50).map(c => (
                          <div 
                            key={c.id} 
                            onClick={() => {
                              setSelectedCourseId(c.id);
                              setCourseName(c.name);
                              setProfessor(c.instructor || '');
                              setSearchTerm('');
                              setIsDropdownOpen(false);
                            }}
                            className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-50 dark:border-slate-800/80 last:border-0"
                          >
                            <div className="font-medium text-slate-800 dark:text-slate-100">{c.name}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                              <span>{c.instructor || '担当教員なし'}</span>
                              <span>•</span>
                              <span>{c.courseCode}</span>
                            </div>
                          </div>
                        ))}
                        {courses.filter(c => 
                          searchTerm.trim() === '' ||
                          (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) || 
                          (c.instructor && c.instructor.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (c.courseCode && c.courseCode.toLowerCase().includes(searchTerm.toLowerCase()))
                        ).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">見つかりません</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">詳細 <span className="text-red-500">*</span></label>
                <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all min-h-[100px]"
                  placeholder="特に大問3以降の解答が知りたいです。"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  キャンセル
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      投稿中...
                    </>
                  ) : '投稿する'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      {/* Confirm Modal */}
      {deleteRequestId && (
        <ConfirmModal
          title="リクエストを削除しますか？"
          description="この操作は取り消せません。"
          confirmText="削除する"
          cancelText="キャンセル"
          variant="danger"
          onClose={() => setDeleteRequestId(null)}
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
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
