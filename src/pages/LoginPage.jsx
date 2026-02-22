import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { apiFetch, setToken } from "/src/api.js";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ If already logged in (token exists), go home
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) navigate("/", { replace: true });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const data = await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      // ✅ Save JWT
      setToken(data.accessToken);

      // ✅ Optional (only if your HomePage still checks isLoggedIn)
      localStorage.setItem("isLoggedIn", "true");

      // ✅ Go to home
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-blue-100 p-8">
        <h1 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Đăng nhập
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Đăng nhập để tiếp tục học tiếng Anh
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* Email */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Email</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Mail className="w-5 h-5 text-gray-500" />
              <input
                type="email"
                className="w-full bg-transparent outline-none"
                placeholder="test@test.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-gray-700 font-medium mb-2">Mật khẩu</label>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <Lock className="w-5 h-5 text-gray-500" />
              <input
                type="password"
                className="w-full bg-transparent outline-none"
                placeholder="123456"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg font-semibold text-white shadow-lg transition
              ${loading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
              }`}
          >
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          <span>Chưa có tài khoản?</span>{" "}
          <button
            className="text-blue-600 hover:text-blue-700 font-semibold"
            onClick={() => navigate("/register")}
            type="button"
          >
            Đăng ký
          </button>
        </div>
      </div>
    </div>
  );
}
