/**
 * Atelic Share Extension - Main View Controller
 * 
 * Handles Instagram post/reel sharing from the iOS share sheet.
 * Displays loading UI, calls Lambda, and opens main app with results.
 */

import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {
    
    // MARK: - Properties
    private let appGroupID = "group.com.atelic.shared"
    private let lambdaEndpoint = "https://adetk4ycvtm7wkwbzppbleegra0auhxi.lambda-url.us-east-1.on.aws/"
    
    private var loadingLabel: UILabel!
    private var activityIndicator: UIActivityIndicatorView!
    private var statusLabel: UILabel!
    
    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        processSharedContent()
    }
    
    // MARK: - UI Setup
    private func setupUI() {
        view.backgroundColor = .white
        
        // Loading indicator
        activityIndicator = UIActivityIndicatorView(style: .large)
        activityIndicator.translatesAutoresizingMaskIntoConstraints = false
        activityIndicator.color = UIColor(red: 0.95, green: 0.39, blue: 0.02, alpha: 1.0) // Atelic orange
        view.addSubview(activityIndicator)
        
        // Loading label
        loadingLabel = UILabel()
        loadingLabel.text = "Finding places from this post..."
        loadingLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        loadingLabel.textColor = .darkGray
        loadingLabel.textAlignment = .center
        loadingLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(loadingLabel)
        
        // Status label
        statusLabel = UILabel()
        statusLabel.font = UIFont.systemFont(ofSize: 14)
        statusLabel.textColor = .gray
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusLabel)
        
        // Layout
        NSLayoutConstraint.activate([
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor, constant: -40),
            
            loadingLabel.topAnchor.constraint(equalTo: activityIndicator.bottomAnchor, constant: 20),
            loadingLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            loadingLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            
            statusLabel.topAnchor.constraint(equalTo: loadingLabel.bottomAnchor, constant: 12),
            statusLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
        
        activityIndicator.startAnimating()
    }
    
    // MARK: - Process Shared Content
    private func processSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("No content to share")
            return
        }
        
        for item in extensionItems {
            guard let attachments = item.attachments else { continue }
            
            for provider in attachments {
                // Check for URL (Instagram link)
                if provider.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (url, error) in
                        guard let self = self,
                              let shareURL = url as? URL,
                              let instagramURL = self.extractInstagramURL(from: shareURL) else {
                            DispatchQueue.main.async {
                                self?.showError("Invalid Instagram link")
                            }
                            return
                        }
                        
                        DispatchQueue.main.async {
                            self.handleInstagramURL(instagramURL)
                        }
                    }
                    return
                }
            }
        }
        
        showError("Couldn't find Instagram link")
    }
    
    // MARK: - Extract Instagram URL
    private func extractInstagramURL(from url: URL) -> String? {
        let urlString = url.absoluteString
        
        // Handle various Instagram URL formats
        if urlString.contains("instagram.com/p/") ||
           urlString.contains("instagram.com/reel/") ||
           urlString.contains("instagram.com/tv/") {
            return urlString
        }
        
        return nil
    }
    
    // MARK: - Handle Instagram URL
    private func handleInstagramURL(_ instagramURL: String) {
        // Check if user is logged in
        guard let userID = getUserID() else {
            showNotLoggedIn()
            return
        }
        
        statusLabel.text = "Processing..."
        
        // Call Lambda function
        callLambda(instagramURL: instagramURL, userID: userID)
    }
    
    // MARK: - Get User ID from App Groups
    private func getUserID() -> String? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
            return nil
        }
        return sharedDefaults.string(forKey: "userID")
    }
    
    // MARK: - Call Lambda
    private func callLambda(instagramURL: String, userID: String) {
        guard let url = URL(string: lambdaEndpoint) else {
            showError("Configuration error")
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body: [String: Any] = [
            "instagramUrl": instagramURL,
            "userID": userID
        ]
        
        guard let jsonData = try? JSONSerialization.data(withJSONObject: body) else {
            showError("Failed to prepare request")
            return
        }
        
        request.httpBody = jsonData
        
        let task = URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                
                if let error = error {
                    self.showError("Network error: \(error.localizedDescription)")
                    return
                }
                
                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let success = json["success"] as? Bool else {
                    self.showError("Invalid response")
                    return
                }
                
                if success {
                    let placesCount = (json["savedPlaces"] as? [[String: Any]])?.count ?? 0
                    self.showSuccess(placesCount: placesCount)
                } else {
                    let message = json["message"] as? String ?? "Failed to process post"
                    self.showError(message)
                }
            }
        }
        
        task.resume()
    }
    
    // MARK: - UI States
    private func showSuccess(placesCount: Int) {
        activityIndicator.stopAnimating()
        loadingLabel.text = "Found \(placesCount) place\(placesCount == 1 ? "" : "s")!"
        statusLabel.text = "Opening Atelic..."
        
        // Open main app
        openMainApp()
        
        // Close extension after short delay
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    private func showError(_ message: String) {
        activityIndicator.stopAnimating()
        loadingLabel.text = "Oops!"
        statusLabel.text = message
        statusLabel.textColor = .systemRed
        
        // Auto-close after 3 seconds
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    private func showNotLoggedIn() {
        activityIndicator.stopAnimating()
        loadingLabel.text = "Please log in to Atelic first"
        statusLabel.text = "Opening Atelic..."
        
        // Open main app to login
        openMainApp()
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
    }
    
    // MARK: - Open Main App
    private func openMainApp() {
        let url = URL(string: "atelic://instagram-import")!
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: nil)
                return
            }
            responder = responder?.next
        }
        
        // Fallback: Use extension context
        extensionContext?.open(url, completionHandler: nil)
    }
}
