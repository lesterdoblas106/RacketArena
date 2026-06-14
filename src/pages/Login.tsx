import { useState } from "react";
import { supabase } from "../lib/supabase";


export default function Login() {    
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);

    const handleSubmit = async () => {
    setLoading(true);

    try {
        if (isSignUp) {
        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;

        alert("Account created successfully!");
        } else {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        }
    } catch (err: any) {
        alert(err.message);
    } finally {
        setLoading(false);
    }
    };

    const signUp = async () => {
    const { error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        alert(error.message);
    } else {
        alert("Account created!");
    }
    };

    const signIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        alert(error.message);
    } else {
        alert("Logged in!");
    }
    };

    const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
        redirectTo: window.location.origin,
        },
    });

    if (error) {
        console.error(error);
    }
    };
    return (

    <div className="auth-form">
        <div className="auth-header">
            <img
                src="/logo.png"
                alt="Racket Arena"
                className="auth-logo"
            />
                <h2>Welcome to Racket Arena</h2>
                <p>
                Sign in to manage your clubs, queues, and badminton sessions.
                </p>
        </div>
        <input
            className="auth-input"
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
        />

        <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
        />

        <button
            className="auth-submit"
            onClick={handleSubmit}
        >
            {loading
                ? "Please wait..."
                : isSignUp
                    ? "Create Account"
                    : "Sign In"}
        </button>

        <div className="auth-divider">
            OR
        </div>

        <button
            className="google-btn"
            onClick={signInWithGoogle}
            >
            Continue with Google
        </button>

        <div className="auth-signup">
            <span>
                {isSignUp
                ? "Already have an account?"
                : "Don't have an account?"}
            </span>

            <button
                type="button"
                className="auth-link"
                onClick={() => setIsSignUp(!isSignUp)}
            >
                {isSignUp ? "Sign In" : "Sign Up"}
            </button>
        </div>

    </div>
    );
}