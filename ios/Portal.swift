import SwiftUI
import WebKit

@main
struct TMSPortalApp: App {
    var body: some Scene { WindowGroup { PortalView() } }
}

struct PortalView: UIViewRepresentable {
    private static let host = "tradersajjad-portal.vercel.app"
#if TMS_ADMIN
    private static let startPath = "/admin/"
    private static let allowedPaths: Set<String> = ["/admin", "/admin/", "/admin/index.html"]
#else
    private static let startPath = "/"
    private static let allowedPaths: Set<String> = ["/", "/index.html"]
#endif

    func makeCoordinator() -> Navigation { Navigation() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        if #available(iOS 16.4, *) { view.isInspectable = false }
        view.navigationDelegate = context.coordinator
        if let url = URL(string: "https://" + Self.host + Self.startPath) {
            view.load(URLRequest(url: url))
        }
        return view
    }

    func updateUIView(_ view: WKWebView, context: Context) {}

    final class Navigation: NSObject, WKNavigationDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let frame = action.targetFrame else { decisionHandler(.cancel); return }
            if !frame.isMainFrame { decisionHandler(.allow); return }
            guard let url = action.request.url,
                  let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
                  parts.scheme == "https", parts.host == PortalView.host,
                  parts.port == nil || parts.port == 443,
                  PortalView.allowedPaths.contains(parts.path) else {
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }
    }
}
