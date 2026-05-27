import React, { useState } from 'react';
import { BookOpen, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export function LoginScreen() {
  const { signIn, error } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | null>(null);

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 transition-colors">
      <main className="max-w-md w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center space-y-6 transition-colors">
        <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
            CampusArchive
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            学内限定の過去問・講義資料共有プラットフォーム
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 text-red-600 text-xs text-left p-3 rounded-lg border border-red-100 flex items-start gap-2 max-w-full overflow-hidden">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-wrap flex-1 leading-5">{error}</span>
          </div>
        )}

        <div className="pt-2 text-left space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-950/50 rounded-lg border border-slate-100 dark:border-slate-800/40 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            ※ @m.isct.ac.jp ドメインのメールアドレスでのみ登録・ログインが可能です。
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
            <input
              id="agree-terms-checkbox"
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="agree-terms-checkbox" className="text-xs text-slate-600 dark:text-slate-300 leading-snug cursor-pointer select-none">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setActiveModal('terms'); }}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                利用規約
              </button>
              と
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); setActiveModal('privacy'); }}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline px-1"
              >
                プライバシーポリシー
              </button>
              を読み、その内容に同意します。
            </label>
          </div>

          <button
            onClick={() => agreed && signIn()}
            disabled={!agreed}
            className={`w-full font-semibold py-3 px-4 rounded-xl transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 flex items-center justify-center gap-2 ${
              agreed
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-60'
            }`}
          >
            Google アカウントでログイン
          </button>
        </div>
      </main>

      {/* Modal Dialog */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col shadow-xl border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-950 dark:text-slate-50">
                {activeModal === 'terms' ? '利用規約' : 'プライバシーポリシー'}
              </h2>
              <button
                onClick={() => setActiveModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed text-left">
              {activeModal === 'terms' ? (
                <>
                  <p>この利用規約（以下、「本規約」といいます。）は、CampusArchive（以下、「当サービス」といいます。）が提供するサービスの利用条件を定めるものです。</p>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第1条（適用）</h4>
                    <p>本規約は、ユーザーと当サービスとの間の、サービスの利用に関わる一切の関係に適用されるものとします。</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第2条（禁止事項）</h4>
                    <p>ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>法令または公序良俗に違反する行為</li>
                      <li>犯罪行為に関連する行為</li>
                      <li>著作権、商標権などの知的財産権を侵害する行為（担当教員が二次配布を禁止している資料の無断アップロードなど）</li>
                      <li>当サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
                      <li>その他,当サービスが不適切と判断する行為</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第3条（免責事項）</h4>
                    <p>当サービスに掲載されている資料の正確性や最新性について、当サービスは一切の保証を行いません。本サービスの利用により生じた損害について、当サービスは一切の責任を負いません。</p>
                  </div>
                </>
              ) : (
                <>
                  <p>CampusArchive（以下、「当サービス」といいます。）は、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第1条（個人情報の収集方法）</h4>
                    <p>当サービスは、ユーザーが利用登録をする際、またGoogleアカウントによるソーシャルログイン時に、氏名、メールアドレス、プロフィール画像等の個人情報を取得・保存します。</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第2条（個人情報を収集・利用する目的）</h4>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      <li>当サービスの提供・運営のため</li>
                      <li>ユーザーの本人確認や学習履歴、ポイント状況の管理を行うため</li>
                      <li>不正行為や規約違反の調査・対応を行うため</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 mb-1">第3条（個人情報の第三者提供）</h4>
                    <p>当サービスは、法令に定める場合を除き、あらかじめユーザーの同意を得ることなく第三者に個人情報を提供することはありません。</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 rounded-b-2xl flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
