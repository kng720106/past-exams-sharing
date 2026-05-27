'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, UploadCloud, FileText, CheckCircle2, ChevronDown, Loader2, Sparkles, Coins, Server, ShieldCheck } from 'lucide-react';
import { storage, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, doc, setDoc, updateDoc, increment, serverTimestamp, query, orderBy, getDocs } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { v4 as uuidv4 } from 'uuid';
import imageCompression from 'browser-image-compression';

interface Course {
  id: string;
  courseCode: string;
  bandai: number;
  category: string;
  name: string;
  instructor: string;
  term: string;
}

interface UploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialCourseId?: string;
  initialCourseName?: string;
  initialProfessor?: string;
  initialTitle?: string;
}

export function UploadModal({ onClose, onSuccess, initialCourseId, initialCourseName, initialProfessor, initialTitle }: UploadModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(initialTitle || '');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(initialCourseId || '');
  const [searchTerm, setSearchTerm] = useState(initialCourseName || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [type, setType] = useState<'pdf' | 'image'>('pdf');
  
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'compressing' | 'uploading' | 'saving' | 'rewarding' | 'completed'>('idle');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const fetchedCourses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Course[];
        setCourses(fetchedCourses);
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setIsLoadingCourses(false);
      }
    };
    fetchCourses();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Limit file size to 5MB and ensure minimum 5KB
      if (!selectedFile.type.includes('image') && selectedFile.size > 5 * 1024 * 1024) {
        setError('ファイルサイズは5MB以内にしてください。');
        setFile(null);
        return;
      }
      if (selectedFile.size < 5 * 1024) {
        setError('ファイルサイズが小さすぎます。有効なドキュメントをアップロードしてください。');
        setFile(null);
        return;
      }
      
      setError(null);
      setFile(selectedFile);
      if (selectedFile.type.includes('pdf')) {
        setType('pdf');
      } else if (selectedFile.type.includes('image')) {
        setType('image');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !user || !title || !selectedCourseId) {
      setError('必須項目を入力し、ファイルを選択してください。');
      return;
    }

    const selectedCourse = courses.find(c => c.id === selectedCourseId);
    if (!selectedCourse) return;

    setIsUploading(true);
    setUploadStatus(file.type.includes('image') ? 'compressing' : 'uploading');
    setError(null);

    try {
      let fileToUpload: File | Blob = file;
      
      // Image compression
      if (file.type.includes('image')) {
        try {
          const options = {
            maxSizeMB: 5,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          fileToUpload = await imageCompression(file, options);
        } catch (error) {
          console.error('Image compression error:', error);
          setError('画像の圧縮に失敗しました。');
          setIsUploading(false);
          setUploadStatus('idle');
          return;
        }
      } else if (file.size > 5 * 1024 * 1024) {
          setError('ファイルサイズは5MB以内にしてください。');
          setIsUploading(false);
          setUploadStatus('idle');
          return;
      }

      // 1. Upload file to Storage
      setUploadStatus('uploading');
      const fileId = uuidv4();
      const fileExtension = file.name.split('.').pop();
      const storagePath = `exams/${user.uid}/${fileId}.${fileExtension}`;
      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(storageRef, fileToUpload as File);
      
      // Setup a timeout for the upload to detect stuck uploads (due to storage rules)
      const uploadTimeout = setTimeout(() => {
        if (progress === 0) {
          uploadTask.cancel();
          setError('アップロードが進みません。Firebase Storageのセキュリティルール（read, writeの許可）が設定されているか確認してください。');
          setIsUploading(false);
          setUploadStatus('idle');
        }
      }, 10000); // 10 seconds timeout

      uploadTask.on(
        'state_changed',
        (snapshot) => {
           const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
           setProgress(p);
           if (p > 0) clearTimeout(uploadTimeout);
        },
        (err) => {
           clearTimeout(uploadTimeout);
           console.error(err);
           setError('ファイルのアップロードに失敗しました。詳細: ' + err.message + '\n\n【重要】Firebase Storageのルールで read, write が許可されていない可能性があります。 Firebaseコンソールからルールを設定してください。');
           setIsUploading(false);
           setUploadStatus('idle');
        },
        async () => {
           clearTimeout(uploadTimeout);
           // Success
           try {
             setUploadStatus('saving');
             const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
             
             // Use batch to ensure atomicity and pass security rules
             const { writeBatch } = await import('firebase/firestore');
             const batch = writeBatch(db);

             const examId = uuidv4();
             const examRef = doc(db, 'exams', examId);
             
             batch.set(examRef, {
               title: title,
               courseId: selectedCourse.id,
               courseName: selectedCourse.name,
               bandai: selectedCourse.bandai,
               category: selectedCourse.category,
               instructor: selectedCourse.instructor,
               year: year,
               type: type,
               authorId: user.uid,
               downloadsCount: 0,
               reportsCount: 0,
               createdAt: serverTimestamp(),
               updatedAt: serverTimestamp(),
             });

             const secureDataRef = doc(db, 'exams', examId, 'secure', 'data');
             batch.set(secureDataRef, {
               fileUrl: downloadURL
             });

             // 3. Increment points
             setUploadStatus('rewarding');
             const userRef = doc(db, 'users', user.uid);
             batch.set(userRef, {
               points: increment(10),
               lastExamId: examId,
               updatedAt: serverTimestamp()
             }, { merge: true });

             await batch.commit();

             setUploadStatus('completed');
             // 1.2s delay for a delightful celebration feedback
             await new Promise(resolve => setTimeout(resolve, 1200));

             setIsUploading(false);
             onSuccess();
           } catch (err: any) {
             console.error(err);
             setError('データの保存に失敗しました。詳細: ' + err.message);
             // Rollback orphaned file
             try {
               const { deleteObject, ref: storageRef } = await import('firebase/storage');
               const { storage } = await import('@/lib/firebase');
               await deleteObject(uploadTask.snapshot.ref);
             } catch (rErr) {}
             setIsUploading(false);
             setUploadStatus('idle');
           }
        }
      );

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'エラーが発生しました。');
      setIsUploading(false);
      setUploadStatus('idle');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-2xl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 z-10 transition-colors">
           <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center flex-wrap gap-2">
             <span className="flex items-center">
               <UploadCloud className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400 shrink-0" />
               ドキュメントをアップロード
             </span>
             <span className="bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-xs border border-indigo-100 dark:border-indigo-800 whitespace-nowrap">
               +10 pt 獲得
             </span>
           </h2>
           {!isUploading && (
             <button type="button" onClick={onClose} className="p-2 -mr-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
               <X className="w-5 h-5" />
             </button>
           )}
        </div>

         {isUploading ? (
           <UploadProgressScreen
             status={uploadStatus}
             progress={progress}
             fileName={file?.name || 'ドキュメントファイル'}
             fileSize={file?.size || 0}
             fileType={file?.type || ''}
           />
         ) : (
           <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 rounded-xl bg-red-50 text-red-600 text-sm border border-red-100 font-medium whitespace-pre-wrap">
              {error}
            </div>
          )}

          {/* File input */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">ファイル <span className="text-red-500">*</span></label>
            <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 rounded-xl p-8 transition-colors bg-slate-50 dark:bg-slate-950/40 flex flex-col items-center justify-center text-center cursor-pointer group">
              <input 
                 type="file" 
                 onChange={handleFileChange}
                 accept="application/pdf,image/*"
                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {file ? (
                <div className="flex flex-col items-center">
                  <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-450 mb-2" />
                  <span className="font-semibold text-slate-800 dark:text-slate-200 break-all max-w-[200px] text-center">{file.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-450 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-10 h-10 text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" />
                  <p className="font-medium text-slate-700 dark:text-slate-300">クリックまたはドラッグ＆ドロップでファイルを選択</p>
                  <p className="text-xs text-slate-500 dark:text-slate-450 mt-1">PDF または 画像ファイル (最大 5MB)</p>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">タイトル <span className="text-red-500">*</span></label>
              <input 
                 type="text" 
                 value={title}
                 onChange={e => setTitle(e.target.value)}
                 className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 rounded-lg outline-none transition-all"
                 placeholder="例: 2023年度 後期 中間試験 解答"
                 required
              />
            </div>
            
            <div className="md:col-span-2 relative">
               <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">講義を選択 <span className="text-red-500">*</span></label>
               
               {selectedCourseId ? (
                 <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg transition-colors">
                   <div>
                     <div className="font-semibold text-indigo-900 dark:text-indigo-200">{courses.find(c => c.id === selectedCourseId)?.name}</div>
                     <div className="text-xs text-indigo-700 dark:text-indigo-450">
                       {courses.find(c => c.id === selectedCourseId)?.instructor} / {courses.find(c => c.id === selectedCourseId)?.courseCode}
                     </div>
                   </div>
                   <button 
                     type="button" 
                     onClick={() => setSelectedCourseId('')} 
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
                     placeholder={isLoadingCourses ? '読み込み中...' : '講義名、担当教員、科目コードで検索'}
                     disabled={isLoadingCourses}
                     className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 rounded-lg outline-none transition-all disabled:opacity-50 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
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
               
               {courses.length === 0 && !isLoadingCourses && (
                 <p className="text-sm text-red-500 mt-2">講義が登録されていません。管理者に講義の追加を依頼してください。</p>
               )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">開講年度</label>
              <input 
                 type="number" 
                 value={year}
                 onChange={e => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                 className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 rounded-lg outline-none transition-all"
                 placeholder="例: 2023"
              />
            </div>
          </div>

          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-xl border border-indigo-100 dark:border-indigo-900/40 flex items-start space-x-3 transition-colors">
             <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
             <div className="text-sm text-indigo-900 dark:text-indigo-200 leading-relaxed">
               投稿すると <strong className="font-bold">10 pts</strong> 付与されます！ポイントを貯めると、他のユーザーのプレミアムコンテンツがアンロック可能です。
             </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100 dark:border-slate-800">
             <button 
               type="button" 
               onClick={onClose}
               className="px-5 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
             >
               キャンセル
             </button>
             <button 
               type="submit" 
               disabled={!file || !title || !selectedCourseId}
               className="px-6 py-2 font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
             >
               投稿する
             </button>
          </div>
        </form>
         )}
      </div>
    </div>
  );
}

interface UploadProgressScreenProps {
  status: 'idle' | 'compressing' | 'uploading' | 'saving' | 'rewarding' | 'completed';
  progress: number;
  fileName: string;
  fileSize: number;
  fileType: string;
}

function UploadProgressScreen({ status, progress, fileName, fileSize, fileType }: UploadProgressScreenProps) {
  const isImage = fileType.includes('image');
  
  // Custom tips to make wait feel shorter and educate about platform contributions
  const LOADING_TIPS = [
    "アップロードされた試験データは、暗号化されて安全に管理されます。",
    "画像ファイルは自動的に最適化され、読み込み速度と表示パフォーマンスが向上します！",
    "過去問のタイトルは「2023年度 後期 中間試験」のように詳しく記述するのがおすすめです。",
    "過去問を投稿するたびに10ポイントをGET！他のプレミアムファイルを閲覧できます。",
    "解答解説付きの過去問は、試験前の学習効率を劇的に高めます。",
    "通報機能が備わっており、不適切な投稿や誤ったコンテンツは迅速に管理・削除されます。"
  ];

  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % LOADING_TIPS.length);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  const getStepState = (step: 'compress' | 'upload' | 'save' | 'reward') => {
    switch (step) {
      case 'compress':
        if (!isImage) return 'skipped';
        if (status === 'compressing') return 'active';
        return 'completed';
      case 'upload':
        if (isImage && status === 'compressing') return 'pending';
        if (status === 'uploading') return 'active';
        return 'completed';
      case 'save':
        if (status === 'saving') return 'active';
        if (status === 'rewarding' || status === 'completed') return 'completed';
        return 'pending';
      case 'reward':
        if (status === 'rewarding') return 'active';
        if (status === 'completed') return 'completed';
        return 'pending';
    }
  };

  const getStepStyle = (state: 'pending' | 'active' | 'completed' | 'skipped') => {
    switch (state) {
      case 'completed':
        return {
          bg: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60',
          text: 'text-emerald-800 dark:text-emerald-300',
          sub: 'text-emerald-600/90 dark:text-emerald-400/80',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        };
      case 'active':
        return {
          bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800 animate-pulse',
          text: 'text-indigo-900 dark:text-indigo-200 font-bold',
          sub: 'text-indigo-700 dark:text-indigo-400',
          icon: <Loader2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-spin" />
        };
      case 'skipped':
        return {
          bg: 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/50',
          text: 'text-slate-400 dark:text-slate-500 line-through',
          sub: 'text-slate-400 dark:text-slate-500',
          icon: <CheckCircle2 className="w-5 h-5 text-slate-300 dark:text-slate-600" />
        };
      case 'pending':
      default:
        return {
          bg: 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-100 dark:border-slate-800/30',
          text: 'text-slate-400 dark:text-slate-500',
          sub: 'text-slate-400 dark:text-slate-500',
          icon: <div className="w-5 h-5 rounded-full border-2 border-slate-200 dark:border-slate-800" />
        };
    }
  };

  const compressStep = getStepStyle(getStepState('compress'));
  const uploadStep = getStepStyle(getStepState('upload'));
  const saveStep = getStepStyle(getStepState('save'));
  const rewardStep = getStepStyle(getStepState('reward'));

  return (
    <div className="p-6 md:p-8 space-y-8 flex flex-col justify-center items-center min-h-[420px]">
      {/* Decorative Main Loading Rings */}
      <div className="relative flex items-center justify-center w-24 h-24 mb-2">
        {status === 'completed' ? (
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [1.3, 1], opacity: 1 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950/40 border-2 border-emerald-400 flex items-center justify-center relative z-10"
          >
            <Sparkles className="absolute w-28 h-28 text-amber-400 animate-ping opacity-35" />
            <Coins className="w-10 h-10 text-amber-500 dark:text-amber-400 animate-bounce" />
          </motion.div>
        ) : (
          <>
            <span className="absolute inline-flex h-full w-full rounded-full bg-indigo-400/15 animate-ping opacity-75"></span>
            <div className="absolute inset-0 rounded-full border-4 border-slate-100 dark:border-slate-800" />
            <div 
              className="absolute inset-0 rounded-full border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent animate-spin"
              style={{ 
                animationDuration: status === 'compressing' ? '1.8s' : status === 'saving' ? '1.2s' : '0.8s' 
              }} 
            />
            <div className="absolute flex flex-col items-center">
              {status === 'uploading' ? (
                <span className="text-xl font-extrabold text-indigo-700 dark:text-indigo-400">{Math.round(progress)}%</span>
              ) : status === 'compressing' ? (
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
              ) : (
                <Server className="w-8 h-8 text-indigo-500 animate-pulse" />
              )}
            </div>
          </>
        )}
      </div>

      {/* Primary Description & Item Meta info */}
      <div className="text-center space-y-2 max-w-md w-full">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 transition-all">
          {status === 'compressing' && '過去問の画像を自動最適化しています...'}
          {status === 'uploading' && `ファイルを送信中... (${Math.round(progress)}%)`}
          {status === 'saving' && 'セキュアなデータベースに過去問情報を保存中...'}
          {status === 'rewarding' && '10ポイント報酬を付与して完了処理中...'}
          {status === 'completed' && 'アップロードが完了しました！'}
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 truncate px-4">
          対象: <span className="font-mono text-slate-500 dark:text-slate-450">{fileName || '試験ドキュメント'}</span> ({(fileSize / 1024 / 1024).toFixed(2)} MB)
        </p>
      </div>

      {/* Horizontal / Grid checklist blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-xl">
        {isImage && (
          <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${compressStep.bg}`}>
            {compressStep.icon}
            <div className="flex-1 min-w-0">
              <div className={`text-xs font-semibold truncate ${compressStep.text}`}>1. ファイルの最適化処理</div>
              <div className={`text-[10px] ${compressStep.sub}`}>高精細画像の軽量・圧縮化</div>
            </div>
          </div>
        )}

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${uploadStep.bg}`}>
          {uploadStep.icon}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold truncate ${uploadStep.text}`}>
              {isImage ? '2.' : '1.'} クラウドへのセキュア転送
              {status === 'uploading' && ` (${Math.round(progress)}%)`}
            </div>
            <div className={`text-[10px] ${uploadStep.sub}`}>暗号化ストレージに保管</div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${saveStep.bg}`}>
          {saveStep.icon}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold truncate ${saveStep.text}`}>{isImage ? '3.' : '2.'} 過去問メタデータの登録</div>
            <div className={`text-[10px] ${saveStep.sub}`}>講義・年度との紐付け保存</div>
          </div>
        </div>

        <div className={`p-3.5 rounded-xl border flex items-center gap-3 transition-colors ${rewardStep.bg}`}>
          {rewardStep.icon}
          <div className="flex-1 min-w-0">
            <div className={`text-xs font-semibold truncate ${rewardStep.text}`}>
              {status === 'completed' ? '完了 (+10 pt 獲得！)' : `${isImage ? '4.' : '3.'} アカウント貢献度の反映`}
            </div>
            <div className={`text-[10px] ${rewardStep.sub}`}>ボーナスポイントの追加</div>
          </div>
        </div>
      </div>

      {/* Smooth continuous slide/progress bar using Framer Motion */}
      <div className="w-full max-w-xl bg-slate-100 dark:bg-slate-800/60 rounded-full h-2 relative overflow-hidden">
        {status === 'completed' ? (
          <div className="bg-emerald-500 h-full w-full rounded-full transition-all duration-300" />
        ) : status === 'uploading' ? (
          <div 
            className="bg-indigo-600 dark:bg-indigo-500 h-full rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }} 
          />
        ) : (
          <motion.div 
            className="absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent rounded-full"
            animate={{ x: ['-100%', '300%'] }}
            transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
          />
        )}
      </div>

      {/* Informative Educational Tips Display to occupy attention */}
      <div className="w-full max-w-xl bg-slate-50 dark:bg-slate-950/40 rounded-xl p-4 border border-slate-100 dark:border-slate-800 transition-colors">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse animate-duration-1000" />
          <span>知っておくと便利な豆知識</span>
        </div>
        <AnimatePresence mode="wait">
          <motion.p
            key={tipIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.35 }}
            className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium md:min-h-[2rem]"
          >
            {LOADING_TIPS[tipIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
