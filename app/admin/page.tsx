'use client';

import React, { useState, useEffect } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, doc, writeBatch, serverTimestamp, query, limit, getDocs, getDoc, getCountFromServer, deleteDoc, updateDoc, orderBy, increment, where } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { useAuth } from '@/components/auth-provider';
import { ShieldAlert, Upload, CheckCircle2, AlertCircle, Trash2, Library, FileText, MessageSquare, Flag, Users, LayoutDashboard, ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { v4 as uuidv4 } from 'uuid';
import { ExamPreviewModal } from '@/components/exam-preview-modal';

export default function AdminPage() {
  const { user, userData } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'import' | 'courses' | 'exams' | 'requests' | 'reports' | 'users'>('overview');

  
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleImport = async () => {
    if (!user || userData?.role !== 'admin') {
      setMessage('管理者権限が必要です。');
      setStatus('error');
      return;
    }

    try {
      setStatus('processing');
      setMessage('処理中...');
      
      const parsedData = JSON.parse(jsonInput);
      
      if (!Array.isArray(parsedData)) {
        throw new Error('JSONは配列である必要があります。');
      }

      const { writeBatch, doc, getDocs, collection } = await import('firebase/firestore');
      
      // Fetch existing courses to resolve duplicates
      const existingCoursesSnapshot = await getDocs(collection(db, 'courses'));
      const existingCoursesMap = new Map<string, string>();
      existingCoursesSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseCode) {
          existingCoursesMap.set(data.courseCode, docSnap.id);
        }
      });

      // Deduplicate incoming data by courseCode (latest wins)
      const uniqueIncomingData: any[] = [];
      const incomingCodes = new Set<string>();
      
      for (let i = parsedData.length - 1; i >= 0; i--) {
        const item = parsedData[i];
        const code = item.courseCode || '';
        if (code) {
          if (!incomingCodes.has(code)) {
            incomingCodes.add(code);
            uniqueIncomingData.unshift(item);
          }
        } else {
          uniqueIncomingData.unshift(item);
        }
      }
      
      // Firestore batch limit is 500
      const chunks = [];
      for (let i = 0; i < uniqueIncomingData.length; i += 400) {
        chunks.push(uniqueIncomingData.slice(i, i + 400));
      }

      let totalImported = 0;

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        
        chunk.forEach((item: any) => {
          let courseId = '';
          const code = item.courseCode || '';
          const isNew = !(code && existingCoursesMap.has(code));
          
          if (!isNew) {
            courseId = existingCoursesMap.get(code)!;
          } else {
            courseId = uuidv4();
            if (code) {
               existingCoursesMap.set(code, courseId);
            }
          }
          
          const docRef = doc(db, 'courses', courseId);
          
          const dataToSet: any = {
            courseCode: code,
            bandai: typeof item.bandai === 'number' ? item.bandai : parseInt(item.bandai) || 0,
            category: item.category || '',
            name: item.name || '',
            instructor: item.instructor || '',
            term: item.term || '',
            updatedAt: serverTimestamp()
          };
          
          if (isNew) {
            dataToSet.createdAt = serverTimestamp();
          }

          batch.set(docRef, dataToSet, { merge: true });
        });

        await batch.commit();
        totalImported += chunk.length;
      }

      setStatus('success');
      setMessage(`${totalImported}件の講義データをインポートしました。（重複がある場合はマージされました）`);
      setJsonInput('');
      
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage('エラーが発生しました: ' + err.message);
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 shrink-0 shadow-xl overflow-y-auto">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-bold text-white">Admin Console</h1>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 hover:text-white transition-colors mb-6 text-slate-400">
            <ArrowLeft className="w-4 h-4" />
            <span>アプリに戻る</span>
          </Link>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-3">Main</div>
          <button onClick={() => setActiveTab('overview')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'overview' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard className="w-4 h-4" /> サマリー
          </button>
          <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'reports' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Flag className="w-4 h-4" /> 通報確認
          </button>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">Data Management</div>
          <button onClick={() => setActiveTab('courses')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'courses' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Library className="w-4 h-4" /> 講義一覧
          </button>
          <button onClick={() => setActiveTab('exams')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'exams' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <FileText className="w-4 h-4" /> 過去問一覧
          </button>
          <button onClick={() => setActiveTab('requests')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'requests' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <MessageSquare className="w-4 h-4" /> リクエスト管理
          </button>
          
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-6 mb-2 px-3">System</div>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Users className="w-4 h-4" /> ユーザー管理
          </button>
          <button onClick={() => setActiveTab('import')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'import' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Upload className="w-4 h-4" /> JSONインポート
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
             <ShieldAlert className="w-5 h-5 text-indigo-600" />
             <span className="font-bold text-slate-800">Admin Console</span>
          </div>
          <div className="flex gap-2">
            <Link href="/" className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-lg">アプリに戻る</Link>
          </div>
        </header>

        {/* Mobile basic tab selector if needed (optional) */}
        <div className="md:hidden p-4 overflow-x-auto whitespace-nowrap bg-white border-b border-slate-100 shrink-0 flex gap-2">
          {['overview','reports','courses','exams','requests','users','import'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-3 py-1.5 text-xs font-semibold rounded-lg ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{tab.toUpperCase()}</button>
          ))}
        </div>

        <div className="p-4 md:p-8 flex-1 max-w-6xl mx-auto w-full">
      {activeTab === 'overview' && <AdminOverview />}
      {activeTab === 'import' && (

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-indigo-500" />
          講義データの一括インポート (JSON)
        </h2>
        
        <p className="text-sm text-slate-500 mb-4">
          以下のフォーマットのJSON配列を貼り付けて、講義情報を一括登録します。Firebaseのルールにより、この操作を実行するには事前にFirebase Consoleであなたのアカウントが `admins` コレクションに登録されている必要があります。
        </p>

        <div className="mb-6 p-4 border border-indigo-100 bg-indigo-50/50 rounded-lg">
          <h3 className="text-sm font-semibold text-indigo-800 mb-2">生成AI用プロンプト（PDFから変換）</h3>
          <p className="text-xs text-indigo-600 mb-2">
            以下のプロンプトをコピーして、ChatGPTやGeminiにPDFファイルと一緒に渡し、JSONデータを生成させてください。
          </p>
          <div className="relative group">
            <textarea
              readOnly
              className="w-full text-xs bg-white text-slate-600 p-3 rounded border border-indigo-100 h-32 focus:outline-none resize-none"
              value={`添付したPDFファイルの講義情報一覧を読み取り、以下のJSON配列のフォーマットで出力してください。

出力形式:
[
  {
    "category": "PDFのヘッダなどに書かれている大きな分類 (例: 文系教養科目、広域教養科目など)",
    "courseCode": "科目コード (例: CSC.T123)",
    "bandai": 番台 (数値で、例: 100。科目コードのハイフンやピリオドの後ろの数字の百の位を基にすることが多いです),
    "name": "科目名 (例: 情報工学基礎)",
    "instructor": "担当教員名 (特定の教員がいない場合は空文字で良いです)",
    "term": "開講クォーター (例: 1Q, 1-2Q, 3Qなど)"
  }
]

【ルール】
- マークダウンのコードブロック (\`\`\`json) で出力してください。
- 途中で省略せず、抽出可能な限りのすべての科目を出力してください。
- 存在しない項目は、空文字 ("") を設定してください。`}
            />
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 mb-6 font-mono text-xs text-slate-600 overflow-x-auto">
{`[
  {
    "category": "文系教養科目",
    "courseCode": "CSC.T123",
    "bandai": 100,
    "name": "情報工学基礎",
    "instructor": "山田 太郎",
    "term": "1Q"
  }
]`}
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="[ { ... }, { ... } ]"
          className="w-full h-64 px-4 py-3 bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg outline-none transition-all mb-4 font-mono text-sm"
        />

        <div className="flex items-center gap-4">
          <button
            onClick={handleImport}
            disabled={status === 'processing' || !jsonInput.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {status === 'processing' ? 'インポート中...' : 'インポートを実行'}
          </button>
          
          {status === 'success' && (
             <span className="flex items-center gap-2 text-green-600 font-medium text-sm">
               <CheckCircle2 className="w-5 h-5" />
               {message}
             </span>
          )}
          {status === 'error' && (
             <span className="flex items-center gap-2 text-red-600 font-medium text-sm">
               <AlertCircle className="w-5 h-5" />
               {message}
             </span>
          )}
        </div>
        </div>
      )}

      {activeTab === 'courses' && <AdminCourses />}
      {activeTab === 'exams' && <AdminExams />}
      {activeTab === 'requests' && <AdminRequests />}
      {activeTab === 'reports' && <AdminReports />}
      {activeTab === 'users' && <AdminUsers />}
        </div>
      </main>
    </div>
  );
}

function AdminCourses() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deduping, setDeduping] = useState(false);
  const [loadLimit, setLoadLimit] = useState(100);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, 'courses'), limit(loadLimit));
        const snap = await getDocs(q);
        setHasMore(snap.docs.length >= loadLimit);
        setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [loadLimit]);

  const handleDelete = async (id: string) => {
    if (!confirm('この講義を削除してもよろしいですか？')) return;
    try {
      await deleteDoc(doc(db, 'courses', id));
      setCourses(courses.filter(c => c.id !== id));
      alert('削除しました。');
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  const handleDedup = async () => {
    if (!confirm('科目コードが重複した講義データを自動的に解消します。(最新のデータを残して重複分を削除) よろしいですか？')) return;
    setDeduping(true);
    try {
      const coursesSnap = await getDocs(collection(db, 'courses'));
      
      const courseMap = new Map<string, any[]>();
      coursesSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.courseCode) { // Only deduplicate by valid courseCode
           const existing = courseMap.get(data.courseCode) || [];
           existing.push({ id: docSnap.id, ...data });
           courseMap.set(data.courseCode, existing);
        }
      });
      
      const duplicatesToRemove: string[] = [];
      const idReplacements = new Map<string, any>();
      
      courseMap.forEach((items, code) => {
        if (items.length > 1) {
          // Keep the latest created as master
          const sorted = items.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return timeB - timeA;
          });
          const master = sorted[0];
          const duplicates = sorted.slice(1);
          
          duplicates.forEach(dup => {
            duplicatesToRemove.push(dup.id);
            idReplacements.set(dup.id, master);
          });
        }
      });
      
      if (duplicatesToRemove.length === 0) {
        alert('重複データは見つかりませんでした。');
        setDeduping(false);
        return;
      }
      
      const examsSnap = await getDocs(collection(db, 'exams'));
      const examsToUpdate: any[] = [];
      examsSnap.forEach(docSnap => {
        const exam = docSnap.data();
        if (idReplacements.has(exam.courseId)) {
           examsToUpdate.push({
             id: docSnap.id,
             newCourseId: idReplacements.get(exam.courseId).id,
             newCourseName: idReplacements.get(exam.courseId).name
           });
        }
      });
      
      let examSuccess = 0;
      let examFailures = 0;
      let courseSuccess = 0;
      let courseFailures = 0;

      for (const exam of examsToUpdate) {
        try {
          await updateDoc(doc(db, 'exams', exam.id), {
            courseId: exam.newCourseId,
            courseName: exam.newCourseName,
            updatedAt: serverTimestamp()
          });
          examSuccess++;
        } catch (e) {
          console.error(`Failed to update exam ${exam.id}:`, e);
          examFailures++;
        }
      }

      for (const dupId of duplicatesToRemove) {
        try {
          await deleteDoc(doc(db, 'courses', dupId));
          courseSuccess++;
        } catch (e) {
          console.error(`Failed to delete course ${dupId}:`, e);
          courseFailures++;
        }
      }

      alert(`${duplicatesToRemove.length}件のうち、${courseSuccess}件の重複講義データを削除しました。(失敗: ${courseFailures}件)
関連する過去問 ${examsToUpdate.length}件のうち、${examSuccess}件の紐付けを更新しました。(失敗: ${examFailures}件)`);
      
      // Reload UI list
      const q = query(collection(db, 'courses'), limit(100));
      const snap = await getDocs(q);
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error(err);
      alert('重複の解消に失敗しました: ' + err.message);
    } finally {
      setDeduping(false);
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-xl border border-slate-200">読み込み中...</div>;

  const filteredCourses = courses.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.courseCode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.instructor || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/30">
        <div>
           <h2 className="font-semibold text-slate-800">講義一覧 (最新{loadLimit}件)</h2>
           <span className="text-xs text-slate-500">※大量のデータは一部のみ表示</span>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="講義名、コード、教員で絞り込み..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
             onClick={handleDedup}
             disabled={deduping}
             className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
             {deduping ? '処理中...' : '重複データを自動解消'}
          </button>
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredCourses.map(c => (
          <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
            <div>
              <div className="font-medium text-slate-900">{c.name}</div>
              <div className="text-xs text-slate-500 flex gap-2">
                <span>{c.courseCode}</span>
                <span>{c.instructor}</span>
                <span>{c.category}</span>
                <span>{c.term}</span>
              </div>
            </div>
            <button onClick={() => handleDelete(c.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filteredCourses.length === 0 && <div className="p-8 text-center text-slate-500">データがありません</div>}
        {hasMore && !searchTerm && (
          <div className="flex justify-center p-4">
            <button 
              onClick={() => setLoadLimit(prev => prev + 100)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminExams() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadLimit, setLoadLimit] = useState(100);
  const [hasMore, setHasMore] = useState(true);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchExams = async () => {
      try {
        const q = query(collection(db, 'exams'), orderBy('createdAt', 'desc'), limit(loadLimit));
        const snap = await getDocs(q);
        setHasMore(snap.docs.length >= loadLimit);
        setExams(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExams();
  }, [loadLimit]);

  const handleDelete = async (id: string) => {
    if (!confirm('この過去問を削除してもよろしいですか？(※実ファイルおよび関連データ、通報、レビューも同時に削除されます)')) return;
    try {
      // 1. Fetch fileURL from secure subcollection
      const secureDoc = await getDoc(doc(db, 'exams', id, 'secure', 'data'));
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
      try { await deleteDoc(doc(db, 'exams', id, 'secure', 'data')); } catch (e) {}

      // 4. Cascade delete: downloads
      try {
        const downloadsSnap = await getDocs(collection(db, 'exams', id, 'downloads'));
        for (const d of downloadsSnap.docs) {
           await deleteDoc(doc(db, 'exams', id, 'downloads', d.id));
        }
      } catch (e) {}

      // 5. Cascade delete: reports related to this exam
      try {
        const reportsSnap = await getDocs(query(collection(db, 'reports'), where('examId', '==', id)));
        for (const r of reportsSnap.docs) {
           await deleteDoc(doc(db, 'reports', r.id));
        }
      } catch (e) {}

      // 6. Cascade delete: reviews related to this exam
      try {
        const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('examId', '==', id)));
        for (const r of reviewsSnap.docs) {
           await deleteDoc(doc(db, 'reviews', r.id));
        }
      } catch (e) {}

      // 7. Delete document from Firestore
      await deleteDoc(doc(db, 'exams', id));
      setExams(exams.filter(e => e.id !== id));
      alert('削除しました。');
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-xl border border-slate-200">読み込み中...</div>;

  const filteredExams = exams.filter(e => 
    (e.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (e.courseName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center bg-indigo-50/30">
        <h2 className="font-semibold text-slate-800">過去問一覧 (最新{loadLimit}件)</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="タイトルや講義名で絞り込み..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredExams.map(e => (
          <div key={e.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
            <div className="flex-1 cursor-pointer" onClick={() => setSelectedExam(e)}>
              <div className="font-medium text-slate-900 hover:text-indigo-600 transition-colors">{e.title}</div>
              <div className="text-xs text-slate-500 flex gap-2">
                <span>{e.courseName}</span>
                <span>{e.year}年度</span>
              </div>
            </div>
            <button onClick={() => handleDelete(e.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 shrink-0">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {filteredExams.length === 0 && <div className="p-8 text-center text-slate-500">データがありません</div>}
        {hasMore && !searchTerm && (
          <div className="flex justify-center p-4">
            <button 
              onClick={() => setLoadLimit(prev => prev + 100)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
      {selectedExam && (
        <ExamPreviewModal
          exam={selectedExam}
          isUnlocked={true}
          onClose={() => setSelectedExam(null)}
          onUnlock={() => {}}
          userPoints={999}
        />
      )}
    </div>
  );
}

function AdminReports() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadLimit, setLoadLimit] = useState(100);
  const [hasMore, setHasMore] = useState(true);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchReports = async () => {
    try {
      const q = query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc'),
        limit(loadLimit)
      );
      const snap = await getDocs(q);
      setHasMore(snap.docs.length >= loadLimit);
      
      const reportList: any[] = [];
      for (const d of snap.docs) {
        const reportData = d.data();
        let examData = null;
        try {
          const examSnap = await getDoc(doc(db, 'exams', reportData.examId));
          if (examSnap.exists()) {
            examData = { id: examSnap.id, ...examSnap.data() };
          }
        } catch (e) {
           // Exam might be deleted
        }
        reportList.push({ id: d.id, ...reportData, exam: examData });
      }
      setReports(reportList);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [loadLimit]);

  const handleDeleteReport = async (reportId: string, examId: string) => {
    if (!confirm('この通報を却下(削除)しますか？\n※通報のみが削除され、過去問自体は残ります。')) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
      
      // Attempt to decrease reportsCount on exam
      try {
         await updateDoc(doc(db, 'exams', examId), {
           reportsCount: increment(-1)
         });
      } catch (e) {
         // ignore if exam is deleted
      }
      setReports(reports.filter(r => r.id !== reportId));
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  const handleDeleteExamAndReport = async (reportId: string, examId: string) => {
    if (!confirm('対象の過去問を削除します。\n(※実ファイルや関連データもすべて削除されます) よろしいですか？')) return;
    try {
      // 1. Fetch fileURL from secure subcollection
      const secureDoc = await getDoc(doc(db, 'exams', examId, 'secure', 'data'));
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
      try { await deleteDoc(doc(db, 'exams', examId, 'secure', 'data')); } catch (e) {}

      // 4. Cascade delete: downloads
      try {
        const downloadsSnap = await getDocs(collection(db, 'exams', examId, 'downloads'));
        for (const d of downloadsSnap.docs) {
           await deleteDoc(doc(db, 'exams', examId, 'downloads', d.id));
        }
      } catch (e) {}

      // 5. Cascade delete: reports related to this exam
      try {
        const reportsSnap = await getDocs(query(collection(db, 'reports'), where('examId', '==', examId)));
        for (const r of reportsSnap.docs) {
           await deleteDoc(doc(db, 'reports', r.id));
        }
      } catch (e) {}

      // 5.5 Cascade delete: reviews related to this exam
      try {
        const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('examId', '==', examId)));
        for (const r of reviewsSnap.docs) {
           await deleteDoc(doc(db, 'reviews', r.id));
        }
      } catch (e) {}

      // 6. Delete document from Firestore
      await deleteDoc(doc(db, 'exams', examId));
      
      setReports(reports.filter(r => r.id !== reportId));
      alert('通報対象の過去問を削除しました。');
    } catch (error: any) {
      console.error(error);
      alert('削除処理中にエラーが発生しました。');
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-xl border border-slate-200">読み込み中...</div>;

  const filteredReports = reports.filter(r => 
    (r.reason || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.exam?.title || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center bg-rose-50/30">
        <h2 className="font-semibold text-slate-800">通報一覧 (最新{loadLimit}件)</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="通報理由、講義名で絞り込み..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredReports.map(r => (
          <div key={r.id} className="p-4 flex flex-col hover:bg-slate-50">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200 mb-1">
                  通報理由
                </span>
                <p className="text-sm font-medium text-slate-800 mt-1">{r.reason}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button 
                  onClick={() => handleDeleteReport(r.id, r.examId)} 
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-lg text-xs font-semibold"
                >
                  通報を却下
                </button>
                {r.exam && (
                   <button 
                     onClick={() => handleDeleteExamAndReport(r.id, r.examId)} 
                     className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-lg text-xs font-semibold flex items-center gap-1"
                   >
                     <Trash2 className="w-3 h-3" /> 対象過去問を削除
                   </button>
                )}
              </div>
            </div>
            
            <div 
              onClick={() => r.exam && setSelectedExam(r.exam)}
              className={`border p-3 rounded-lg flex items-center gap-3 transition-colors ${r.exam ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 cursor-pointer' : 'bg-slate-50 border-slate-100'}`}
            >
               {r.exam ? (
                 <>
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${r.exam.type === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
                      {r.exam.type === 'pdf' ? <FileText className="w-4 h-4" /> : <Library className="w-4 h-4" />}
                   </div>
                   <div className="flex-1 truncate">
                     <div className="font-medium text-slate-700 text-sm truncate hover:text-indigo-600 transition-colors">{r.exam.title}</div>
                     <div className="text-xs text-slate-500 truncate">{r.exam.courseName}</div>
                   </div>
                 </>
               ) : (
                 <div className="text-sm text-slate-500 italic">この通報対象の過去問はすでに削除されています。</div>
               )}
            </div>
          </div>
        ))}
        {filteredReports.length === 0 && <div className="p-8 text-center text-slate-500">通報はありません</div>}
        {hasMore && !searchTerm && (
          <div className="flex justify-center p-4">
            <button 
              onClick={() => setLoadLimit(prev => prev + 100)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
      {selectedExam && (
        <ExamPreviewModal
          exam={selectedExam}
          isUnlocked={true}
          onClose={() => setSelectedExam(null)}
          onUnlock={() => {}}
          userPoints={999}
        />
      )}
    </div>
  );
}

function AdminRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadLimit, setLoadLimit] = useState(100);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const q = query(collection(db, 'requests'), orderBy('createdAt', 'desc'), limit(loadLimit));
        const snap = await getDocs(q);
        setHasMore(snap.docs.length >= loadLimit);
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchRequests();
  }, [loadLimit]);

  const handleDelete = async (id: string) => {
    if (!confirm('このリクエストを削除してもよろしいですか？')) return;
    try {
      await deleteDoc(doc(db, 'requests', id));
      setRequests(requests.filter(r => r.id !== id));
      alert('削除しました。');
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-xl border border-slate-200">読み込み中...</div>;

  const filteredRequests = requests.filter(r => 
    (r.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (r.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (r.courseName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center bg-indigo-50/30">
        <h2 className="font-semibold text-slate-800">リクエスト掲示板 (最新{loadLimit}件)</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="タイトル、説明で検索..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredRequests.map(r => (
          <div key={r.id} className="p-4 flex flex-col hover:bg-slate-50">
            <div className="flex justify-between items-start mb-1">
              <div className="font-medium text-slate-900">{r.title}</div>
              <button onClick={() => handleDelete(r.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-slate-600 mb-2 truncate">{r.description}</div>
            <div className="text-xs text-slate-500 flex gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${r.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{r.status}</span>
              {r.courseName && <span>{r.courseName}</span>}
            </div>
          </div>
        ))}
        {filteredRequests.length === 0 && <div className="p-8 text-center text-slate-500">データがありません</div>}
        {hasMore && !searchTerm && (
          <div className="flex justify-center p-4">
            <button 
              onClick={() => setLoadLimit(prev => prev + 100)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminUsers() {
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadLimit, setLoadLimit] = useState(100);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const q = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc'),
          limit(loadLimit)
        );
        const snap = await getDocs(q);
        setHasMore(snap.docs.length >= loadLimit);
        setUsersList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [loadLimit]);

  const toggleAdminRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`このユーザーを${newRole === 'admin' ? '管理者' : '一般ユーザー'}に変更しますか？`)) return;
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: serverTimestamp()
      });
      setUsersList(usersList.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error(err);
      alert('権限の更新に失敗しました。');
    }
  };

  if (loading) return <div className="p-4 bg-white rounded-xl border border-slate-200">読み込み中...</div>;

  const filteredUsers = usersList.filter(u => 
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-indigo-50/30">
        <h2 className="font-semibold text-slate-800">ユーザー一覧 (最新{loadLimit}件)</h2>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="メールアドレス、ユーザーIDで検索..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-slate-200 rounded-lg text-sm w-full sm:w-64 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>
      <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
        {filteredUsers.map(u => (
          <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50">
            <div>
              <div className="font-medium text-slate-900">{u.email || 'メールアドレスなし'}</div>
              <div className="text-xs text-slate-500">ID: {u.id} | pt: {u.points || 0}</div>
            </div>
            <button
              onClick={() => toggleAdminRole(u.id, u.role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
            >
              {u.role === 'admin' ? '管理者' : '一般'}
            </button>
          </div>
        ))}
        {filteredUsers.length === 0 && <div className="p-8 text-center text-slate-500">データがありません</div>}
        {hasMore && !searchTerm && (
          <div className="flex justify-center p-4">
            <button 
              onClick={() => setLoadLimit(prev => prev + 100)}
              className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors"
            >
              もっと見る
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AdminOverview() {
  const [stats, setStats] = useState<{ users: number, courses: number, exams: number, reports: number, requests: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [usersSnap, coursesSnap, examsSnap, reportsSnap, requestsSnap] = await Promise.all([
          getCountFromServer(collection(db, 'users')),
          getCountFromServer(collection(db, 'courses')),
          getCountFromServer(collection(db, 'exams')),
          getCountFromServer(collection(db, 'reports')),
          getCountFromServer(collection(db, 'requests'))
        ]);
        setStats({
          users: usersSnap.data().count,
          courses: coursesSnap.data().count,
          exams: examsSnap.data().count,
          reports: reportsSnap.data().count,
          requests: requestsSnap.data().count
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-200">読み込み中...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-6 h-6 text-indigo-600" />
        <h2 className="text-xl font-bold text-slate-800">アナリティクスサマリー</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase">総合ユーザー数</div>
            <div className="text-3xl font-bold text-slate-800">{stats?.users.toLocaleString() || 0}</div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
            <Library className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase">登録講義数</div>
            <div className="text-3xl font-bold text-slate-800">{stats?.courses.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="p-4 bg-orange-50 text-orange-600 rounded-xl">
            <FileText className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase">アップロード過去問</div>
            <div className="text-3xl font-bold text-slate-800">{stats?.exams.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-sm flex items-center gap-4 col-span-1 hover:shadow-md transition-shadow">
          <div className="p-4 bg-rose-50 text-rose-600 rounded-xl">
            <Flag className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold text-rose-500 uppercase">通報件数</div>
            <div className="text-3xl font-bold text-slate-800">{stats?.reports.toLocaleString() || 0}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 col-span-1 hover:shadow-md transition-shadow">
          <div className="p-4 bg-sky-50 text-sky-600 rounded-xl">
            <MessageSquare className="w-8 h-8" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-500 uppercase">リクエストボード総数</div>
            <div className="text-3xl font-bold text-slate-800">{stats?.requests.toLocaleString() || 0}</div>
          </div>
        </div>

      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 opacity-75 mt-8 hover:opacity-100 transition-opacity">
        <h3 className="text-lg font-semibold text-slate-800 mb-2">使い方・管理運用について</h3>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
           <li>このダッシュボードでは、プラットフォーム全体のデータを管理・監視できます。</li>
           <li>通報があった過去問は、内容を確認の上<b>「問題なければ却下」「問題があれば対象の過去問を削除」</b>してください。</li>
           <li>講義インポートは、配布されたPDFシラバス等をChatGPT等のAIに投げ、指定されたJSON構造に変換して一括投入することで初期立ち上げに使えます。</li>
           <li>試験データには個人情報や問題のあるデータがないか定期的に目視で確認してください。</li>
        </ul>
      </div>
    </div>
  );
}
