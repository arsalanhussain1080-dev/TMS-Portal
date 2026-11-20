using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media.Imaging;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;

internal static class Program
{
    private const string PortalHost = "tradersajjad-portal.vercel.app";
#if TMS_ADMIN
    private const string Role = "Admin";
    private const string PortalPath = "/admin/";
#else
    private const string Role = "Student";
    private const string PortalPath = "/";
#endif

    [DllImport("user32.dll")]
    private static extern bool SetWindowDisplayAffinity(IntPtr hwnd, uint affinity);

    [STAThread]
    private static void Main()
    {
        var app = new Application();
        var icon = System.Drawing.Icon.ExtractAssociatedIcon(
            System.Reflection.Assembly.GetExecutingAssembly().Location);
        var view = new WebView2();
        var window = new Window {
            Title = "TMS " + Role, Width = 1250, Height = 840,
            MinWidth = 375, MinHeight = 480, Content = view
        };
        if (icon != null)
        {
            using (icon)
                window.Icon = Imaging.CreateBitmapSourceFromHIcon(icon.Handle, Int32Rect.Empty,
                    BitmapSizeOptions.FromEmptyOptions());
        }

        window.SourceInitialized += (_, __) => {
            var handle = new WindowInteropHelper(window).Handle;
            SetWindowDisplayAffinity(handle, 0x11);
        };
        window.Loaded += async (_, __) => {
            try
            {
                var data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                    "TMS", Role);
                var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: data);
                await view.EnsureCoreWebView2Async(environment);
                var browser = view.CoreWebView2;
                browser.Settings.AreDevToolsEnabled = false;
                browser.Settings.AreDefaultContextMenusEnabled = false;
                browser.NavigationStarting += (sender, e) => e.Cancel = !IsPortalRoute(e.Uri);
                browser.NewWindowRequested += (sender, e) => e.Handled = true;
                browser.DownloadStarting += (sender, e) => e.Cancel = true;
                window.PreviewKeyDown += (sender, e) => {
                    if (e.Key == Key.F5) { browser.Reload(); e.Handled = true; }
                };
                browser.Navigate("https://" + PortalHost + PortalPath);
            }
            catch (WebView2RuntimeNotFoundException)
            {
                MessageBox.Show("Install Microsoft Edge WebView2 Runtime, then reopen TMS.", window.Title);
                window.Close();
            }
            catch (Exception)
            {
                MessageBox.Show("TMS could not start. Reopen the app to try again.", window.Title);
                window.Close();
            }
        };
        window.Closed += (_, __) => view.Dispose();
        app.Run(window);
    }

    private static bool IsPortalRoute(string destination)
    {
        if (!Uri.TryCreate(destination, UriKind.Absolute, out var url) ||
            url.Scheme != Uri.UriSchemeHttps || url.Host != PortalHost || url.Port != 443)
            return false;
#if TMS_ADMIN
        return url.AbsolutePath == "/admin/" || url.AbsolutePath == "/admin" ||
            url.AbsolutePath == "/admin/index.html";
#else
        return url.AbsolutePath == "/" || url.AbsolutePath == "/index.html";
#endif
    }
}
