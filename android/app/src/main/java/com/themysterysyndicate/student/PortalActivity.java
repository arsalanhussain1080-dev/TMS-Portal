package com.themysterysyndicate.student;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public final class PortalActivity extends Activity {
    private static final String PORTAL_HOST = "tradersajjad-portal.vercel.app";
    private FrameLayout root;
    private WebView portal;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            }
            return insets;
        });
        WebView.setWebContentsDebuggingEnabled(false);
        portal = new WebView(this);
        WebSettings settings = portal.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        portal.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                android.net.Uri url = request.getUrl();
                String path = url.getPath();
                return !"https".equals(url.getScheme()) || !PORTAL_HOST.equals(url.getHost())
                    || (url.getPort() != -1 && url.getPort() != 443)
                    || (!isPortalPath(path));
            }
        });
        portal.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden();
                    return;
                }
                fullscreenView = view;
                fullscreenCallback = callback;
                portal.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
                getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            }

            @Override
            public void onHideCustomView() {
                closeFullscreen();
            }
        });
        root.addView(portal, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (state == null || portal.restoreState(state) == null) {
            portal.loadUrl("https://" + PORTAL_HOST + (BuildConfig.ADMIN_PORTAL ? "/admin/" : "/"));
        }
    }

    private boolean isPortalPath(String path) {
        if (BuildConfig.ADMIN_PORTAL) {
            return "/admin/".equals(path) || "/admin".equals(path) || "/admin/index.html".equals(path);
        }
        return "/".equals(path) || "/index.html".equals(path);
    }

    @Override
    protected void onSaveInstanceState(Bundle state) {
        portal.saveState(state);
        super.onSaveInstanceState(state);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (fullscreenView != null) closeFullscreen();
        else if (portal.canGoBack()) portal.goBack();
        else super.onBackPressed();
    }

    private void closeFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView);
        fullscreenView = null;
        WebChromeClient.CustomViewCallback callback = fullscreenCallback;
        fullscreenCallback = null;
        portal.setVisibility(View.VISIBLE);
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        callback.onCustomViewHidden();
    }

    @Override
    protected void onDestroy() {
        closeFullscreen();
        root.removeView(portal);
        portal.destroy();
        super.onDestroy();
    }
}
