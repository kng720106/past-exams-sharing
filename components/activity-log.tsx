import React, { useState, useEffect } from 'react';
import { Clock, PlusCircle, MinusCircle } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, documentId, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/components/auth-provider';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityItem {
  id: string;
  type: 'earned' | 'spent';
  points: number;
  title: string;
  date: Date;
}

export function ActivityLog() {
  const { user, userData } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !userData) return;

    const fetchActivity = async () => {
      setLoading(true);
      try {
        const logs: ActivityItem[] = [];

        // Fetch earned points: Exams authored by the user
        const earnedQ = query(
          collection(db, 'exams'), 
          where('authorId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        let earnedSnap;
        try {
          earnedSnap = await getDocs(earnedQ);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'exams');
        }

        if (earnedSnap) {
          earnedSnap.forEach(docSnap => {
            const data = docSnap.data();
            if (data.createdAt) {
              logs.push({
                id: `earned-${docSnap.id}`,
                type: 'earned',
                points: 10,
                title: `過去問をアップロード: ${data.title}`,
                date: data.createdAt.toDate()
              });
            }
          });
        }

        // Fetch spent points: Exams downloaded by the user
        const downloadedIds = userData.downloadedExams || [];
        if (downloadedIds.length > 0) {
          // We limit to 10 for safety in IN queries
          const queryIds = downloadedIds.slice(-10);
          const spentQ = query(
            collection(db, 'exams'),
            where(documentId(), 'in', queryIds)
          );
          let spentSnap;
          try {
            spentSnap = await getDocs(spentQ);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, 'exams');
          }
          
          // Since we might not have the exact download date without doing more queries,
          // we mock the date to be recently if not easily fetchable, 
          // or we can fetch the real download dates for this subset.
          if (spentSnap) {
            await Promise.all(spentSnap.docs.map(async (examDoc) => {
              const data = examDoc.data();
              // Fetch download doc directly using the document ID (which is the user's uid)
              const downloadDocRef = doc(db, 'exams', examDoc.id, 'downloads', user.uid);
              let downloadDocSnap;
              try {
                downloadDocSnap = await getDoc(downloadDocRef);
              } catch (err) {
                handleFirestoreError(err, OperationType.GET, `exams/${examDoc.id}/downloads/${user.uid}`);
              }

              if (downloadDocSnap && downloadDocSnap.exists()) {
                const downloadData = downloadDocSnap.data();
                if (downloadData.downloadedAt) {
                  logs.push({
                    id: `spent-${examDoc.id}`,
                    type: 'spent',
                    points: 5,
                    title: `過去問をロック解除: ${data.title}`,
                    date: downloadData.downloadedAt.toDate()
                  });
                }
              }
            }));
          }
        }

        // Sort by date descending
        logs.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivities(logs.slice(0, 15)); // keep top 15
      } catch (err) {
        console.error("Error fetching activity:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchActivity();
  }, [user, userData]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm animate-pulse flex flex-col space-y-4 transition-colors">
         <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
         <div className="space-y-3 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex justify-between items-center py-2">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                   <div className="space-y-1">
                      <div className="h-4 w-40 bg-slate-200 dark:bg-slate-800 rounded"></div>
                      <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/50 rounded"></div>
                   </div>
                </div>
                <div className="h-4 w-12 bg-slate-200 dark:bg-slate-800 rounded"></div>
              </div>
            ))}
         </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm transition-colors mb-8">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-500" />
        ポイントアクティビティ
      </h3>
      {activities.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500 dark:text-slate-400">
          まだアクティビティがありません。過去問をアップロードして履歴を作ろう！
        </div>
      ) : (
        <div className="space-y-4">
          {activities.map(log => (
            <div key={log.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
               <div className="flex items-center gap-3">
                 {log.type === 'earned' ? (
                   <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                     <PlusCircle className="w-5 h-5" />
                   </div>
                 ) : (
                   <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
                     <MinusCircle className="w-5 h-5" />
                   </div>
                 )}
                 <div>
                   <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 line-clamp-1">{log.title}</div>
                   <div className="text-xs text-slate-500 dark:text-slate-400">
                     {formatDistanceToNow(log.date, { locale: ja, addSuffix: true })}
                   </div>
                 </div>
               </div>
               <div className={`font-bold shrink-0 ${log.type === 'earned' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                 {log.type === 'earned' ? '+' : '-'}{log.points} pt
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
