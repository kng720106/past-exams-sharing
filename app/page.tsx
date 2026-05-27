"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  LayoutDashboard,
  Library,
  BookOpen,
  Scale,
  BookMarked,
  UploadCloud,
  Download,
  Plus,
  Clock,
  FileText,
  FileImage,
  LogOut,
  MessageSquare,
  User,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { LoginScreen } from "@/components/login-screen";
import { UploadModal } from "@/components/upload-modal";
import { ExamFeed } from "@/components/exam-feed";
import { RequestBoard } from "@/components/request-board";
import { ActivityLog } from "@/components/activity-log";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";

export default function Home() {
  const { user, userData, loading, logOut } = useAuth();

  // For UI state
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bandaiFilter, setBandaiFilter] = useState<number | "">("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [courseIdFilter, setCourseIdFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [isLoadingCourses, setIsLoadingCourses] = useState(true);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadInitialState, setUploadInitialState] = useState<{
    courseName?: string;
    courseId?: string;
    professor?: string;
    title?: string;
  }>({});
  const [todaysNewCount, setTodaysNewCount] = useState<number | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // 画面外クリックでメニューを閉じる
    const handleClickOutside = (e: MouseEvent) => {
      // 簡易的な実装として、ドロップダウン以外のクリックで閉じる
      if (isProfileMenuOpen) setIsProfileMenuOpen(false);
    };
    if (isProfileMenuOpen) {
      // Slightly delayed attached to avoid closing immediately on trigger click
      setTimeout(
        () => document.addEventListener("click", handleClickOutside),
        10,
      );
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isProfileMenuOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isDark = localStorage.getItem("theme") === "dark";
      setIsDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add("dark");
        document.documentElement.style.colorScheme = "dark";
      } else {
        document.documentElement.classList.remove("dark");
        document.documentElement.style.colorScheme = "light";
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDarkMode;
    setIsDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.style.colorScheme = "dark";
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.style.colorScheme = "light";
      localStorage.setItem("theme", "light");
    }
  };

  useEffect(() => {
    // Fetch courses
    const fetchCourses = async () => {
      try {
        const q = query(collection(db, "courses"));
        const snapshot = await getDocs(q);
        const fetchedCourses = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setCourses(fetchedCourses);
      } catch (err) {
        console.error("Failed to fetch courses:", err);
      } finally {
        setIsLoadingCourses(false);
      }
    };

    // Fetch today's new count
    const fetchTodaysNew = async () => {
      try {
        const { getCountFromServer } = await import("firebase/firestore");
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const q = query(
          collection(db, "exams"),
          where("createdAt", ">=", Timestamp.fromDate(startOfToday)),
        );
        const snapshot = await getCountFromServer(q);
        setTodaysNewCount(snapshot.data().count);
      } catch (err) {
        console.error("Error fetching today's new:", err);
      }
    };

    const fetchTotalDownloads = async () => {
      try {
        const { getAggregateFromServer, sum, count } = await import("firebase/firestore");
        const q = query(collection(db, "exams"));
        const snapshot = await getAggregateFromServer(q, {
          totalDownloads: sum("downloadsCount")
        });
        setTotalDownloads(snapshot.data().totalDownloads);
      } catch (err) {
        console.error("Error fetching total downloads:", err);
      }
    };

    if (user) {
      fetchCourses();
      fetchTodaysNew();
      fetchTotalDownloads();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center transition-colors">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-400"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden items-stretch transition-colors">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 transition-colors">
        <div className="p-6 flex items-center space-x-2">
          <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">
            C
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            CampusArchive
          </span>
        </div>
        <nav className="flex-1 mt-4 px-2 space-y-1 overflow-y-auto">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setBandaiFilter("");
              setCategoryFilter("");
              setActiveTab("dashboard");
            }}
            className={`flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg mb-1 transition-all ${activeTab === "dashboard" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>ダッシュボード</span>
          </a>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("search");
            }}
            className={`flex items-center space-x-3 px-4 py-3 text-sm font-medium rounded-lg mb-1 transition-all ${activeTab === "search" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            <Search className="w-4 h-4" />
            <span>講義検索</span>
          </a>

          <div className="px-4 py-2 mt-4 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            マイメニュー
          </div>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setBandaiFilter("");
              setCategoryFilter("");
              setActiveTab("requests");
            }}
            className={`flex items-center space-x-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "requests" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>リクエスト掲示板</span>
          </a>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setBandaiFilter("");
              setCategoryFilter("");
              setActiveTab("my-posts");
            }}
            className={`flex items-center space-x-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "my-posts" ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
          >
            <User className="w-4 h-4" />
            <span>マイ投稿・管理</span>
          </a>
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2 shrink-0 transition-colors">
          <button
            onClick={() => {
              setUploadInitialState({});
              setIsUploadModalOpen(true);
            }}
            className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-semibold shadow-md shadow-indigo-100 dark:shadow-none transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>過去問を投稿する</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative pb-16 md:pb-0 bg-slate-50 dark:bg-slate-950 transition-colors">
        {/* Header */}
        <header className="sticky top-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-30 transition-colors">
          <div className="flex items-center md:hidden">
            <div className="w-8 h-8 bg-indigo-600 dark:bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold mr-2">
              C
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-100">
              CampusArchive
            </span>
          </div>
          <div className="hidden md:block flex-1 max-w-lg">
            {/* Search bar removed per request */}
          </div>
          <div className="flex items-center space-x-4 ml-auto">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold dark:text-slate-100">
                {user.displayName || "ゲストユーザー"}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {user.email}
              </div>
            </div>
            <div className="relative">
              <div
                className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-800 shadow-sm overflow-hidden flex-shrink-0 cursor-pointer"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              >
                {user.photoURL ? (
                  <Image
                    src={user.photoURL}
                    alt="Avatar"
                    width={40}
                    height={40}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-medium">
                    {user.displayName?.charAt(0) || "U"}
                  </div>
                )}
              </div>

              {isProfileMenuOpen && (
                <div className="absolute top-12 right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 sm:hidden">
                    <div className="text-sm font-semibold dark:text-slate-100 truncate">
                      {user.displayName || "ゲストユーザー"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab("settings");
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center transition-colors"
                  >
                    設定・テーマ変更
                  </button>
                  <button
                    onClick={() => {
                      logOut();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center transition-colors"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
          {/* Stats Grid */}
          {activeTab === "dashboard" && (
            <>
              {/* Point System Banner */}
              <div className="bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-5 mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-sm transition-colors">
                <div className="flex items-start space-x-4 min-w-0 flex-1">
                  <div className="bg-indigo-600 rounded-full p-2 mt-1 shrink-0">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg mb-1">
                      ポイントシステムの仕組み
                    </h3>
                    <p className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                      初めに <strong>10 pts (2回分)</strong>{" "}
                      がプレゼントされます。
                      <br />
                      過去問アップロードで <strong>+10 pts</strong>{" "}
                      獲得。過去問の閲覧・ダウンロードで <strong>5 pt</strong>{" "}
                      消費。
                      <br />
                      <span className="text-xs opacity-75 block mt-1">
                        ※
                        一度ポイントを消費して閲覧した過去問は、以降何度でも無料で閲覧できます。（ロック解除済みとなります）
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 w-full lg:w-auto shrink-0">
                  <button
                    onClick={() => {
                      setUploadInitialState({});
                      setIsUploadModalOpen(true);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow flex items-center justify-center flex-1 lg:flex-none transition-colors whitespace-nowrap text-sm sm:text-base shrink-0"
                  >
                    <UploadCloud className="w-4 h-4 mr-2 shrink-0" />
                    アップロードしてpt獲得
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1 duration-200 text-slate-800 dark:text-slate-100">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                    総ダウンロード数
                  </div>
                  <div className="text-3xl font-bold">
                    {totalDownloads !== null
                      ? totalDownloads.toLocaleString()
                      : "-"}{" "}
                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                      回
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1 duration-200 text-slate-800 dark:text-slate-100">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                    所持ポイント
                  </div>
                  <div className="text-3xl font-bold">
                    {userData?.points || 0}{" "}
                    <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
                      pts
                    </span>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-transform hover:-translate-y-1 duration-200">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">
                    今日の新着
                  </div>
                  <div className="text-3xl font-bold dark:text-slate-100">
                    {todaysNewCount !== null ? todaysNewCount : "-"}{" "}
                    <span className="text-sm font-normal text-slate-400">
                      件
                    </span>
                  </div>
                </div>
              </div>

              <ActivityLog />
            </>
          )}

          <div className="flex flex-col lg:flex-row space-y-8 lg:space-y-0 lg:space-x-8">
            {/* Latest Posts */}
            <div className="flex-1 space-y-4">
              {activeTab === "settings" && (
                <div className="bg-white dark:bg-slate-900 p-6 md:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-4xl mx-auto space-y-8 transition-colors">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    設定
                  </h2>

                  <div className="border-b border-slate-100 dark:border-slate-800 pb-6">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
                      テーマ設定（ダークモード）
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      アプリケーションのテーマを切り替えます。
                    </p>

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => {
                          if (isDarkMode) toggleTheme();
                        }}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${!isDarkMode ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"}`}
                      >
                        ライトモード
                      </button>
                      <button
                        onClick={() => {
                          if (!isDarkMode) toggleTheme();
                        }}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all font-medium ${isDarkMode ? "border-indigo-500 bg-slate-800 text-indigo-400" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"}`}
                      >
                        ダークモード
                      </button>
                    </div>
                  </div>

                  {/* 利用規約セクション */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                      利用規約
                    </h3>
                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <p>
                        この利用規約（以下、「本規約」といいます。）は、CampusArchive（以下、「当サービス」といいます。）が提供するサービスの利用条件を定めるものです。
                      </p>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第1条（適用）
                        </h4>
                        <p>
                          本規約は、ユーザーと当サービスとの間の、サービスの利用に関わる一切の関係に適用されるものとします。
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第2条（禁止事項）
                        </h4>
                        <p>
                          ユーザーは、当サービスの利用にあたり、以下の行為をしてはなりません。
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>法令または公序良俗に違反する行為</li>
                          <li>犯罪行為に関連する行為</li>
                          <li>
                            著作権、商標権などの知的財産権を侵害する行為（担当教員が二次配布を禁止している資料の無断アップロードなど）
                          </li>
                          <li>
                            当サービスのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為
                          </li>
                          <li>その他、当サービスが不適切と判断する行為</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第3条（免責事項）
                        </h4>
                        <p>
                          当サービスに掲載されている資料の正確性や最新性について、当サービスは一切の保証を行いません。本サービスの利用により生じた損害について、当サービスは一切の責任を負いません。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* プライバシーポリシーセクション */}
                  <div className="border-b border-slate-100 dark:border-slate-800 pb-6">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-3">
                      プライバシーポリシー
                    </h3>
                    <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/50">
                      <p>
                        CampusArchive（以下、「当サービス」といいます。）は、ユーザーの個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
                      </p>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第1条（個人情報の収集方法）
                        </h4>
                        <p>
                          当サービスは、ユーザーが利用登録をする際、またGoogleアカウントによるソーシャルログイン時に、氏名、メールアドレス、プロフィール画像等の個人情報を取得・保存します。
                        </p>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第2条（個人情報を収集・利用する目的）
                        </h4>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>当サービスの提供・運営のため</li>
                          <li>
                            ユーザーの本人確認や学習履歴、ポイント状況の管理を行うため
                          </li>
                          <li>不正行為や規約違反の調査・対応を行うため</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">
                          第3条（個人情報の第三者提供）
                        </h4>
                        <p>
                          当サービスは、法令に定める場合を除き、あらかじめユーザーの同意を得ることなく第三者に個人情報を提供することはありません。
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* コピーライトセクション */}
                  <div className="text-center text-xs text-slate-400 dark:text-slate-500 pt-2">
                    &copy; 2026 CampusArchive. All rights reserved.
                  </div>
                </div>
              )}

              {activeTab === "search" && (
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-6 space-y-4 transition-colors">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    講義・条件で絞り込む
                  </h2>

                  <div className="space-y-4">
                    {/* Course Selection */}
                    <div className="relative">
                      <label className="block text-xs font-semibold text-slate-500 mb-1">
                        講義を選択
                      </label>
                      {courseIdFilter ? (
                        <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-lg transition-colors">
                          <div>
                            <div className="font-semibold text-indigo-900 dark:text-indigo-200">
                              {
                                courses.find((c) => c.id === courseIdFilter)
                                  ?.name
                              }
                            </div>
                            <div className="text-xs text-indigo-700 dark:text-indigo-400">
                              {
                                courses.find((c) => c.id === courseIdFilter)
                                  ?.instructor
                              }{" "}
                              /{" "}
                              {
                                courses.find((c) => c.id === courseIdFilter)
                                  ?.courseCode
                              }
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setCourseIdFilter("")}
                            className="p-1 hover:bg-indigo-100 rounded text-indigo-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value);
                              setIsDropdownOpen(true);
                            }}
                            onFocus={() => setIsDropdownOpen(true)}
                            onBlur={() =>
                              setTimeout(() => setIsDropdownOpen(false), 200)
                            }
                            placeholder={
                              isLoadingCourses
                                ? "読み込み中..."
                                : "講義名、担当教員、科目コードで検索"
                            }
                            disabled={isLoadingCourses}
                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/50 rounded-lg outline-none transition-all disabled:opacity-50"
                          />

                          {isDropdownOpen && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                              {courses
                                .filter(
                                  (c) =>
                                    searchTerm.trim() === "" ||
                                    (c.name &&
                                      c.name
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase())) ||
                                    (c.instructor &&
                                      c.instructor
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase())) ||
                                    (c.courseCode &&
                                      c.courseCode
                                        .toLowerCase()
                                        .includes(searchTerm.toLowerCase())),
                                )
                                .slice(0, 50)
                                .map((c) => (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      setCourseIdFilter(c.id);
                                      setSearchTerm("");
                                      setIsDropdownOpen(false);
                                    }}
                                    className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer border-b border-slate-50 dark:border-slate-800/80 last:border-0"
                                  >
                                    <div className="font-medium text-slate-800 dark:text-slate-100">
                                      {c.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-2">
                                      <span>
                                        {c.instructor || "担当教員なし"}
                                      </span>
                                      <span>•</span>
                                      <span>{c.courseCode}</span>
                                    </div>
                                  </div>
                                ))}
                              {courses.filter(
                                (c) =>
                                  searchTerm.trim() === "" ||
                                  (c.name &&
                                    c.name
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase())) ||
                                  (c.instructor &&
                                    c.instructor
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase())) ||
                                  (c.courseCode &&
                                    c.courseCode
                                      .toLowerCase()
                                      .includes(searchTerm.toLowerCase())),
                              ).length === 0 && (
                                <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-center">
                                  見つかりません
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          カテゴリ
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          value={categoryFilter}
                          onChange={(e) => setCategoryFilter(e.target.value)}
                          disabled={!!courseIdFilter} // Disable if specific course selected
                        >
                          <option value="">すべて</option>
                          <option value="文系教養科目">文系教養科目</option>
                          <option value="理工系教養科目">理工系教養科目</option>
                          <option value="英語科目">英語科目</option>
                          <option value="第二外国語科目">第二外国語科目</option>
                          <option value="広域教養科目">広域教養科目</option>
                          <option value="基礎専門科目">基礎専門科目</option>
                          <option value="専門科目">専門科目</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">
                          番台
                        </label>
                        <select
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                          value={bandaiFilter}
                          onChange={(e) =>
                            setBandaiFilter(
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value),
                            )
                          }
                          disabled={!!courseIdFilter} // Disable if specific course selected
                        >
                          <option value="">すべて</option>
                          <option value="100">100番台 (学士1年)</option>
                          <option value="200">200番台 (学士2年)</option>
                          <option value="300">300番台 (学士3年)</option>
                          <option value="400">400番台 (学士4年)</option>
                          <option value="500">500番台 (修士1年)</option>
                          <option value="600">600番台 (修士2年)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "requests" ? (
                <RequestBoard
                  courses={courses}
                  onRequestClick={(req) => {
                    setUploadInitialState({
                      courseName: req.courseName,
                      professor: req.professor,
                      title: `Re: ${req.title}`,
                    });
                    setIsUploadModalOpen(true);
                  }}
                />
              ) : activeTab === "my-posts" ? (
                <div className="space-y-12">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                      ダウンロード済みの過去問
                    </h2>
                    <ExamFeed downloadedOnly={true} courses={courses} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                      自分がアップロードした過去問
                    </h2>
                    <ExamFeed authorFilter={user.uid} courses={courses} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4">
                      自分のリクエスト
                    </h2>
                    <RequestBoard
                      authorFilter={user.uid}
                      courses={courses}
                      hideForm={true}
                    />
                  </div>
                </div>
              ) : activeTab === "dashboard" || activeTab === "search" ? (
                <>
                  {activeTab === "search" ? (
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      検索結果
                    </h2>
                  ) : (
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                      最新の投稿
                    </h2>
                  )}
                  <ExamFeed
                    bandaiFilter={
                      activeTab === "search" ? bandaiFilter : undefined
                    }
                    categoryFilter={
                      activeTab === "search" ? categoryFilter : undefined
                    }
                    courseIdFilter={
                      activeTab === "search" ? courseIdFilter : undefined
                    }
                    keywordFilter={
                      activeTab === "search" ? keywordFilter : undefined
                    }
                    courses={courses}
                  />
                </>
              ) : null}
            </div>

            {/* Right Sidebar Area */}
            {activeTab === "dashboard" && (
              <div className="lg:w-80 space-y-6">
                {/* Premium Card */}
                <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden group">
                  <div className="relative z-10">
                    <h3 className="font-bold text-lg mb-2">プレミアム会員</h3>
                    <p className="text-indigo-200 text-xs mb-4 leading-relaxed">
                      全ての過去問がダウンロードし放題。試験対策を万全に。
                    </p>
                    <button className="bg-white mt-2 text-indigo-900 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm">
                      詳細を見る
                    </button>
                  </div>
                  <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-indigo-700/50 rounded-full blur-xl group-hover:bg-indigo-600/50 transition-colors"></div>
                  <div className="absolute top-4 right-4 w-12 h-12 bg-white/10 rounded-full blur-md"></div>
                </div>

                {/* Request Board Snippet */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>リクエストをチェック</span>
                  </h3>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                    他の学生が求めている過去問をアップロードして、ポイントを獲得しましょう！
                  </div>
                  <button
                    onClick={() => {
                      setBandaiFilter("");
                      setCategoryFilter("");
                      setActiveTab("requests");
                    }}
                    className="w-full text-center text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-800/50 py-2.5 rounded-lg transition-colors"
                  >
                    リクエスト一覧を見る
                  </button>
                </div>
              </div>
            )}
          </div>


        </div>
      </main>

      {isUploadModalOpen && (
        <UploadModal
          onClose={() => setIsUploadModalOpen(false)}
          onSuccess={() => setIsUploadModalOpen(false)}
          initialCourseName={uploadInitialState.courseName}
          initialCourseId={uploadInitialState.courseId}
          initialProfessor={uploadInitialState.professor}
          initialTitle={uploadInitialState.title}
        />
      )}

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 z-30 flex justify-around items-center h-16 pb-safe transition-colors">
        <button
          onClick={() => {
            setBandaiFilter("");
            setCategoryFilter("");
            setActiveTab("dashboard");
          }}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === "dashboard" ? "text-indigo-600" : "text-slate-500 hover:text-indigo-500"}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium">ホーム</span>
        </button>
        <button
          onClick={() => setActiveTab("search")}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === "search" ? "text-indigo-600" : "text-slate-500 hover:text-indigo-500"}`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium">検索</span>
        </button>
        <button
          onClick={() => {
            setUploadInitialState({});
            setIsUploadModalOpen(true);
          }}
          className="flex flex-col items-center justify-center w-full h-full"
        >
          <div className="bg-indigo-600 text-white p-2 rounded-full mb-1 shadow-lg shadow-indigo-600/30 dark:shadow-none transform -translate-y-2">
            <Plus className="w-5 h-5" />
          </div>
        </button>
        <button
          onClick={() => {
            setBandaiFilter("");
            setCategoryFilter("");
            setActiveTab("requests");
          }}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === "requests" ? "text-indigo-600" : "text-slate-500 hover:text-indigo-500"}`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-medium">要望</span>
        </button>
        <button
          onClick={() => {
            setBandaiFilter("");
            setCategoryFilter("");
            setActiveTab("my-posts");
          }}
          className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${activeTab === "my-posts" ? "text-indigo-600" : "text-slate-500 hover:text-indigo-500"}`}
        >
          <User className="w-5 h-5" />
          <span className="text-[10px] font-medium">マイ</span>
        </button>
      </nav>
    </div>
  );
}
