import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Brain,
  MessageSquare,
  Trophy,
  Menu,
  X,
  Zap,
  Users,
  UserCircle,
  Shield,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getToken, logout, getMyRole } from "../api";

export default function HomePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("beginner");
  const navigate = useNavigate();

  // ✅ AUTH GUARD
  useEffect(() => {
    const token = getToken();
    if (!token) navigate("/login", { replace: true });
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const isAdmin = getMyRole() === "ADMIN";

  const features = [
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Học Từ Vựng",
      description: "Hơn 10.000 từ vựng tiếng Anh cùng phát âm và ví dụ thực tế",
      link: "/vocabulary",
    },
    {
      icon: <Brain className="w-8 h-8" />,
      title: "Luyện Ngữ Pháp",
      description: "Bài học ngữ pháp có hệ thống và bài tập tương tác cho mọi trình độ",
      link: "/grammar",
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Luyện Nói Tiếng Anh",
      description: "Tình huống giao tiếp thực tế với phản hồi từ AI",
      link: "#",
    },
    {
      icon: <Trophy className="w-8 h-8" />,
      title: "Kiểm Tra Trình Độ",
      description: "Các bài thi mô phỏng TOEIC & IELTS giúp bạn theo dõi tiến độ học",
      link: "#",
    },
  ];

  const levels = [
    { id: "beginner", name: "A1-A2", desc: "Trình độ Sơ cấp", color: "bg-green-500" },
    { id: "intermediate", name: "B1-B2", desc: "Trình độ Trung cấp", color: "bg-blue-500" },
    { id: "advanced", name: "C1-C2", desc: "Trình độ Cao cấp", color: "bg-purple-500" },
  ];

  const stats = [
    { icon: <Users className="w-6 h-6" />, value: "50.000+", label: "Học viên" },
    { icon: <BookOpen className="w-6 h-6" />, value: "1.000+", label: "Bài học" },
    { icon: <Zap className="w-6 h-6" />, value: "95%", label: "Hài lòng" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Navbar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => navigate("/")}
            >
              <img
                src="/logo1.png"
                alt="Englisanity Logo"
                className="w-10 h-10 rounded-lg object-cover shadow-sm"
              />
              <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Englisanity
              </span>
            </div>

            {/* Desktop menu */}
            <div className="hidden md:flex space-x-8">
              <a href="#features" className="text-gray-700 hover:text-blue-600 transition">
                Tính năng
              </a>
              <a href="#levels" className="text-gray-700 hover:text-blue-600 transition">
                Trình độ
              </a>
              <a href="#pricing" className="text-gray-700 hover:text-blue-600 transition">
                Giá cả
              </a>
              <a href="#contact" className="text-gray-700 hover:text-blue-600 transition">
                Liên hệ
              </a>
            </div>

            {/* Desktop buttons */}
            <div className="hidden md:flex items-center space-x-3">
              {/* ✅ Admin shortcut (only if ADMIN) */}
              {isAdmin && (
                <button
                  onClick={() => navigate("/admin")}
                  className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition"
                  title="Admin"
                >
                  <Shield className="w-6 h-6 text-gray-700" />
                </button>
              )}

              {/* ✅ Profile icon */}
              <button
                onClick={() => navigate("/profile")}
                className="w-10 h-10 flex items-center justify-center rounded-full border border-gray-200 hover:bg-gray-50 transition"
                title="Thông tin cá nhân"
              >
                <UserCircle className="w-6 h-6 text-gray-700" />
              </button>

              <button
                onClick={handleLogout}
                className="px-4 py-2 text-blue-600 hover:text-blue-700 transition"
              >
                Đăng xuất
              </button>

              <button className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition shadow-lg">
                Bắt đầu ngay
              </button>
            </div>

            {/* Mobile menu toggle */}
            <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden py-4 space-y-2">
              <a
                href="#features"
                className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
              >
                Tính năng
              </a>
              <a
                href="#levels"
                className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
              >
                Trình độ
              </a>
              <a
                href="#pricing"
                className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
              >
                Giá cả
              </a>
              <a
                href="#contact"
                className="block px-4 py-2 text-gray-700 hover:bg-blue-50 rounded"
              >
                Liên hệ
              </a>

              <div className="flex flex-col space-y-2 px-4 pt-2">
                {/* ✅ Admin (mobile) */}
                {isAdmin && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      navigate("/admin");
                    }}
                    className="py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Admin
                  </button>
                )}

                {/* ✅ Profile (mobile) */}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    navigate("/profile");
                  }}
                  className="py-2 text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Thông tin cá nhân
                </button>

                <button
                  onClick={handleLogout}
                  className="py-2 text-blue-600 border border-blue-600 rounded-lg"
                >
                  Đăng xuất
                </button>

                <button className="py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg">
                  Bắt đầu ngay
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
          Làm chủ tiếng Anh
          <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mt-2">
            Dễ dàng & Hiệu quả
          </span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Học thông minh hơn với bài học ứng dụng AI và phương pháp khoa học giúp bạn nói,
          viết và hiểu tiếng Anh tự tin hơn mỗi ngày.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button className="px-8 py-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg text-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition shadow-xl">
            Học thử miễn phí
          </button>
          <button className="px-8 py-4 bg-white text-gray-800 rounded-lg text-lg font-semibold hover:bg-gray-50 transition shadow-lg border-2 border-gray-200">
            Xem demo
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto mt-12">
          {stats.map((s, i) => (
            <div key={i} className="bg-white rounded-xl shadow-lg p-6 border border-blue-50">
              <div className="flex items-center justify-center text-blue-500 mb-2">{s.icon}</div>
              <div className="text-3xl font-bold text-gray-900">{s.value}</div>
              <div className="text-gray-600">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Tính năng nổi bật</h2>
          <p className="text-xl text-gray-600 mb-16">Tất cả những gì bạn cần để làm chủ tiếng Anh</p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, idx) => (
              <div
                key={idx}
                onClick={() => {
                  if (feature.link && feature.link !== "#") navigate(feature.link);
                }}
                className="p-6 bg-gradient-to-br from-white to-blue-50 rounded-xl shadow-lg hover:shadow-2xl transition border border-blue-100 hover:-translate-y-1 cursor-pointer"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levels */}
      <section id="levels" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Chọn trình độ của bạn</h2>
          <p className="text-xl text-gray-600 mb-16">Lộ trình học rõ ràng từ cơ bản đến nâng cao</p>

          <div className="grid md:grid-cols-3 gap-8">
            {levels.map((level) => (
              <div
                key={level.id}
                onClick={() => setSelectedLevel(level.id)}
                className={`p-8 rounded-xl shadow-lg cursor-pointer transition hover:shadow-2xl ${
                  selectedLevel === level.id
                    ? "bg-gradient-to-br from-blue-500 to-indigo-500 text-white scale-105"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                <div
                  className={`w-12 h-12 ${
                    selectedLevel === level.id ? "bg-white text-blue-500" : level.color
                  } rounded-lg flex items-center justify-center mb-4 font-bold text-xl`}
                >
                  {level.name.split("-")[0]}
                </div>
                <h3 className="text-2xl font-bold mb-2">{level.name}</h3>
                <p
                  className={`text-lg mb-4 ${
                    selectedLevel === level.id ? "text-white" : "text-gray-600"
                  }`}
                >
                  {level.desc}
                </p>
                <button
                  className={`w-full py-2 rounded-lg font-semibold transition ${
                    selectedLevel === level.id
                      ? "bg-white text-blue-500 hover:bg-gray-100"
                      : "bg-blue-500 text-white hover:bg-blue-600"
                  }`}
                >
                  Bắt đầu học
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-500 to-indigo-500 text-center text-white">
        <h2 className="text-4xl font-bold mb-6">Sẵn sàng chinh phục tiếng Anh?</h2>
        <p className="text-xl mb-8 max-w-2xl mx-auto">
          Tham gia cùng hàng ngàn học viên đang nâng cao kỹ năng tiếng Anh mỗi ngày.
        </p>
        <button className="px-8 py-4 bg-white text-blue-500 rounded-lg text-lg font-semibold hover:bg-gray-100 transition shadow-xl">
          Tham gia miễn phí
        </button>
      </section>
    </div>
  );
}
