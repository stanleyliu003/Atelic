/**
 * Atelic Share Extension - Main View Controller
 *
 * Handles Instagram post/reel sharing from the iOS share sheet.
 * Displays loading UI with progress bar, calls Lambda, and opens main app with results.
 * Presented as a half-height modal with close button and swipe-to-dismiss.
 */

import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    // MARK: - Properties
    private let appGroupID = "group.com.atelic.shared"
    private var lambdaEndpoint: String {
        Bundle.main.object(forInfoDictionaryKey: "LambdaEndpoint") as? String
            ?? "https://adetk4ycvtm7wkwbzppbleegra0auhxi.lambda-url.us-east-1.on.aws/"
    }
    private let atelicOrange = UIColor(red: 0.95, green: 0.39, blue: 0.02, alpha: 1.0)
    private let successGreen = UIColor(red: 0.20, green: 0.78, blue: 0.35, alpha: 1.0)

    // UI Elements
    private var containerView: UIView!
    private var dragIndicator: UIView!
    private var closeButton: UIButton!
    private var logoImageView: UIImageView!
    private var progressBarBackground: UIView!
    private var progressBarFill: UIView!
    private var statusLabel: UILabel!
    private var viewSavedPlacesButton: UIButton!
    private var checkmarkView: UIView!
    private var checkmarkImageView: UIImageView!

    // Constraints
    private var panGestureRecognizer: UIPanGestureRecognizer!
    private var containerBottomConstraint: NSLayoutConstraint!
    private var progressBarWidthConstraint: NSLayoutConstraint!

    // State
    private var progressTimer: Timer?
    private var currentProgress: CGFloat = 0
    private var limitExceeded: Bool = false

    // MARK: - Lifecycle
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupGestures()
        processSharedContent()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        animateIn()
        startProgressAnimation()
    }

    // MARK: - UI Setup
    private func setupUI() {
        // Semi-transparent background
        view.backgroundColor = UIColor.black.withAlphaComponent(0.0)

        // Tap background to dismiss
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(backgroundTapped))
        tapGesture.delegate = self
        view.addGestureRecognizer(tapGesture)

        // Container view (bottom sheet)
        containerView = UIView()
        containerView.backgroundColor = .white
        containerView.layer.cornerRadius = 20
        containerView.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)

        // Drag indicator (pill at top)
        dragIndicator = UIView()
        dragIndicator.backgroundColor = UIColor.systemGray4
        dragIndicator.layer.cornerRadius = 2.5
        dragIndicator.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(dragIndicator)

        // Logo in top left (tappable to open main app)
        logoImageView = UIImageView()
        logoImageView.image = UIImage(named: "Atelic_Logo_Updated")
        logoImageView.contentMode = .scaleAspectFit
        logoImageView.translatesAutoresizingMaskIntoConstraints = false
        logoImageView.isUserInteractionEnabled = true
        let logoTapGesture = UITapGestureRecognizer(target: self, action: #selector(logoTapped))
        logoImageView.addGestureRecognizer(logoTapGesture)
        containerView.addSubview(logoImageView)

        // Close button in top right - light gray circle with black X (35x35, 50% of original)
        closeButton = UIButton(type: .custom)
        closeButton.backgroundColor = UIColor(red: 243/255, green: 244/255, blue: 246/255, alpha: 1.0) // #F3F4F6
        closeButton.layer.cornerRadius = 17.5 // Half of 35 for circular shape
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)

        // Add X icon (50% smaller: 12pt instead of 24pt)
        let xImage = UIImage(systemName: "xmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 12, weight: .medium))
        closeButton.setImage(xImage, for: .normal)
        closeButton.tintColor = .black
        containerView.addSubview(closeButton)

        // Progress bar background
        progressBarBackground = UIView()
        progressBarBackground.backgroundColor = UIColor.systemGray5
        progressBarBackground.layer.cornerRadius = 6
        progressBarBackground.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(progressBarBackground)

        // Progress bar fill
        progressBarFill = UIView()
        progressBarFill.backgroundColor = atelicOrange
        progressBarFill.layer.cornerRadius = 6
        progressBarFill.translatesAutoresizingMaskIntoConstraints = false
        progressBarBackground.addSubview(progressBarFill)

        // Status label (1.5X size: 16 * 1.5 = 24) - Outfit font, black text
        statusLabel = UILabel()
        statusLabel.text = "Saving destinations..."
        // Try to use Outfit font, fallback to system font if not available
        if let outfitFont = UIFont(name: "Outfit-Medium", size: 24) {
            statusLabel.font = outfitFont
        } else if let outfitFont = UIFont(name: "Outfit-Regular", size: 24) {
            statusLabel.font = outfitFont
        } else {
            statusLabel.font = UIFont.systemFont(ofSize: 24, weight: .medium)
        }
        statusLabel.textColor = .black
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)

        // View Saved Places Button (orange with white text, hidden initially)
        viewSavedPlacesButton = UIButton(type: .system)
        viewSavedPlacesButton.setTitle("See places on Atelic", for: .normal)
        viewSavedPlacesButton.backgroundColor = atelicOrange
        viewSavedPlacesButton.setTitleColor(.white, for: .normal)
        viewSavedPlacesButton.layer.cornerRadius = 14
        viewSavedPlacesButton.contentEdgeInsets = UIEdgeInsets(top: 18, left: 32, bottom: 18, right: 32)
        // Try to use Outfit Bold font for button, fallback to bold system font
        if let outfitFont = UIFont(name: "Outfit-Bold", size: 19) {
            viewSavedPlacesButton.titleLabel?.font = outfitFont
        } else if let outfitFont = UIFont(name: "Outfit-Medium", size: 19) {
            viewSavedPlacesButton.titleLabel?.font = outfitFont
        } else {
            viewSavedPlacesButton.titleLabel?.font = UIFont.systemFont(ofSize: 19, weight: .bold)
        }
        viewSavedPlacesButton.translatesAutoresizingMaskIntoConstraints = false
        viewSavedPlacesButton.alpha = 0
        viewSavedPlacesButton.addTarget(self, action: #selector(viewSavedPlacesButtonTapped), for: .touchUpInside)
        containerView.addSubview(viewSavedPlacesButton)

        // Checkmark container (hidden initially) - larger size
        checkmarkView = UIView()
        checkmarkView.backgroundColor = successGreen
        checkmarkView.layer.cornerRadius = 50
        checkmarkView.translatesAutoresizingMaskIntoConstraints = false
        checkmarkView.alpha = 0
        checkmarkView.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
        containerView.addSubview(checkmarkView)

        // Checkmark icon - larger size
        checkmarkImageView = UIImageView()
        checkmarkImageView.image = UIImage(systemName: "checkmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 46, weight: .bold))
        checkmarkImageView.tintColor = .white
        checkmarkImageView.contentMode = .scaleAspectFit
        checkmarkImageView.translatesAutoresizingMaskIntoConstraints = false
        checkmarkView.addSubview(checkmarkImageView)

        // Container starts off-screen (will animate in)
        containerBottomConstraint = containerView.bottomAnchor.constraint(equalTo: view.bottomAnchor, constant: 300)

        // Progress bar width starts at 0
        progressBarWidthConstraint = progressBarFill.widthAnchor.constraint(equalToConstant: 0)

        // Layout
        NSLayoutConstraint.activate([
            // Container - 50% height
            containerView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            containerView.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.5),
            containerBottomConstraint,

            // Drag indicator
            dragIndicator.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 12),
            dragIndicator.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            dragIndicator.widthAnchor.constraint(equalToConstant: 40),
            dragIndicator.heightAnchor.constraint(equalToConstant: 5),

            // Logo - top left (170x170, shifted up by 40px from original 12pt = -28pt)
            logoImageView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: -28),
            logoImageView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 12),
            logoImageView.widthAnchor.constraint(equalToConstant: 170),
            logoImageView.heightAnchor.constraint(equalToConstant: 170),

            // Close button - top right (35x35, 50% of original size)
            closeButton.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 20),
            closeButton.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
            closeButton.widthAnchor.constraint(equalToConstant: 35),
            closeButton.heightAnchor.constraint(equalToConstant: 35),

            // Progress bar - centered
            progressBarBackground.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            progressBarBackground.centerYAnchor.constraint(equalTo: containerView.centerYAnchor, constant: -20),
            progressBarBackground.widthAnchor.constraint(equalTo: containerView.widthAnchor, multiplier: 0.7),
            progressBarBackground.heightAnchor.constraint(equalToConstant: 12),

            // Progress bar fill
            progressBarFill.leadingAnchor.constraint(equalTo: progressBarBackground.leadingAnchor),
            progressBarFill.topAnchor.constraint(equalTo: progressBarBackground.topAnchor),
            progressBarFill.bottomAnchor.constraint(equalTo: progressBarBackground.bottomAnchor),
            progressBarWidthConstraint,

            // Checkmark view - centered where progress bar is, larger size
            checkmarkView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            checkmarkView.centerYAnchor.constraint(equalTo: containerView.centerYAnchor, constant: -40),
            checkmarkView.widthAnchor.constraint(equalToConstant: 100),
            checkmarkView.heightAnchor.constraint(equalToConstant: 100),

            // Status label - more spacing below checkmark (40pt instead of 20pt)
            statusLabel.topAnchor.constraint(equalTo: checkmarkView.bottomAnchor, constant: 40),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),

            // View Saved Places Button - positioned below checkmark, larger and moved down
            viewSavedPlacesButton.topAnchor.constraint(equalTo: checkmarkView.bottomAnchor, constant: 55),
            viewSavedPlacesButton.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            viewSavedPlacesButton.heightAnchor.constraint(equalToConstant: 56),

            // Checkmark icon
            checkmarkImageView.centerXAnchor.constraint(equalTo: checkmarkView.centerXAnchor),
            checkmarkImageView.centerYAnchor.constraint(equalTo: checkmarkView.centerYAnchor)
        ])
    }

    // MARK: - Progress Animation
    private func startProgressAnimation() {
        let totalDuration: TimeInterval = 1.5
        let steps = 60
        let interval = totalDuration / Double(steps)
        let progressBarWidth = UIScreen.main.bounds.width * 0.7

        var step = 0
        progressTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] timer in
            guard let self = self else {
                timer.invalidate()
                return
            }

            step += 1
            let progress = CGFloat(step) / CGFloat(steps)
            self.currentProgress = progress

            // Ease-out animation curve
            let easedProgress = 1 - pow(1 - progress, 3)
            self.progressBarWidthConstraint.constant = progressBarWidth * easedProgress

            UIView.animate(withDuration: interval) {
                self.progressBarBackground.layoutIfNeeded()
            }

            if step >= steps {
                timer.invalidate()
                self.progressTimer = nil
                // Only show success if limit was not exceeded
                if !self.limitExceeded {
                    self.showSuccessCheckmark()
                }
            }
        }
    }

    // Show success checkmark (called after 1.5s progress bar completes, regardless of Lambda result)
    private func showSuccessCheckmark() {
        // Hide progress bar and status label
        UIView.animate(withDuration: 0.2) {
            self.progressBarBackground.alpha = 0
            self.statusLabel.alpha = 0
        }

        // Show checkmark with spring animation
        UIView.animate(withDuration: 0.5, delay: 0.1, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5) {
            self.checkmarkView.alpha = 1
            self.checkmarkView.transform = .identity
        }

        // Show button after checkmark animation
        UIView.animate(withDuration: 0.3, delay: 0.6) {
            self.viewSavedPlacesButton.alpha = 1
        }
    }

    private func completeProgress() {
        progressTimer?.invalidate()
        progressTimer = nil

        let progressBarWidth = UIScreen.main.bounds.width * 0.7
        progressBarWidthConstraint.constant = progressBarWidth

        UIView.animate(withDuration: 0.2) {
            self.progressBarBackground.layoutIfNeeded()
        }
    }

    // MARK: - Gestures
    private func setupGestures() {
        panGestureRecognizer = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        containerView.addGestureRecognizer(panGestureRecognizer)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let translation = gesture.translation(in: view)
        let velocity = gesture.velocity(in: view)

        switch gesture.state {
        case .changed:
            // Only allow dragging down
            if translation.y > 0 {
                containerBottomConstraint.constant = translation.y
            }
        case .ended:
            // If dragged more than 100pt or fast velocity, dismiss
            if translation.y > 100 || velocity.y > 500 {
                dismissExtension()
            } else {
                // Snap back
                animateIn()
            }
        default:
            break
        }
    }

    @objc private func backgroundTapped() {
        dismissExtension()
    }

    @objc private func closeButtonTapped() {
        dismissExtension()
    }

    @objc private func logoTapped() {
        openMainApp(route: "saved_places")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.dismissExtension()
        }
    }

    @objc private func viewSavedPlacesButtonTapped() {
        // Pass timestamp so saved_places knows to show loading and auto-refresh after 14s
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        openMainApp(route: "saved_places?shareStartTime=\(timestamp)")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
            self.dismissExtension()
        }
    }

    // MARK: - Animations
    private func animateIn() {
        containerBottomConstraint.constant = 0
        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            self.view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
            self.view.layoutIfNeeded()
        }
    }

    private func dismissExtension() {
        progressTimer?.invalidate()
        containerBottomConstraint.constant = 300
        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseIn) {
            self.view.backgroundColor = UIColor.black.withAlphaComponent(0.0)
            self.view.layoutIfNeeded()
        } completion: { _ in
            self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
        }
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

        // Call Lambda function (fire-and-forget)
        // Main app will auto-refresh after 14s when user taps "See places on Atelic"
        callLambda(instagramURL: instagramURL, userID: userID)
    }

    // MARK: - Get User ID from App Groups
    // Prefer cognitoUsername (e.g. signinwithapple_xxx) which matches userID in DynamoDB.
    // Falls back to userID (Cognito sub) for backward compatibility.
    private func getUserID() -> String? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupID) else {
            return nil
        }
        return sharedDefaults.string(forKey: "cognitoUsername")
            ?? sharedDefaults.string(forKey: "userID")
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

        print("[ShareExtension] Starting Lambda request")
        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            if let error = error {
                print("[ShareExtension] Lambda error: \(error.localizedDescription)")
                return
            }

            // Check for limit exceeded response
            if let data = data,
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let errorCode = json["error"] as? String,
               errorCode == "LIMIT_EXCEEDED" {
                print("[ShareExtension] Limit exceeded for user")
                DispatchQueue.main.async {
                    self?.showLimitExceeded()
                }
                return
            }

            print("[ShareExtension] Lambda request completed")
        }.resume()
    }

    // MARK: - UI States
    private func showSuccess(placesCount: Int) {
        // Success is already shown by the progress bar completion
        // Lambda response is processed silently - no UI changes needed
        // User stays on the share extension until they tap logo or dismiss
    }

    private func showError(_ message: String) {
        // Errors are now silently logged - the UI always shows success
        // since the checkmark appears after 1.5s regardless of Lambda result
        print("Share extension error (silent): \(message)")
    }

    private func showNotLoggedIn() {
        progressTimer?.invalidate()

        // Hide progress bar
        UIView.animate(withDuration: 0.2) {
            self.progressBarBackground.alpha = 0
        }

        statusLabel.text = "Please log in to Atelic first"
        statusLabel.textColor = .systemOrange

        // Show warning icon
        checkmarkView.backgroundColor = .systemOrange
        checkmarkImageView.image = UIImage(systemName: "person.crop.circle.badge.exclamationmark", withConfiguration: UIImage.SymbolConfiguration(pointSize: 32, weight: .medium))

        UIView.animate(withDuration: 0.5, delay: 0.1, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5) {
            self.checkmarkView.alpha = 1
            self.checkmarkView.transform = .identity
        }

        // User can tap logo to open main app for login, or dismiss the extension
    }

    private func showLimitExceeded() {
        limitExceeded = true
        progressTimer?.invalidate()
        progressTimer = nil

        // Hide progress bar
        UIView.animate(withDuration: 0.2) {
            self.progressBarBackground.alpha = 0
        }

        statusLabel.numberOfLines = 0
        statusLabel.lineBreakMode = .byWordWrapping
        statusLabel.text = "Exceeded sharing limit\nfor this week."
        statusLabel.textColor = .systemOrange

        // Show warning icon
        checkmarkView.backgroundColor = .systemOrange
        checkmarkImageView.image = UIImage(systemName: "exclamationmark.triangle.fill", withConfiguration: UIImage.SymbolConfiguration(pointSize: 46, weight: .bold))

        UIView.animate(withDuration: 0.5, delay: 0.1, usingSpringWithDamping: 0.6, initialSpringVelocity: 0.5) {
            self.checkmarkView.alpha = 1
            self.checkmarkView.transform = .identity
        }
    }

    // MARK: - Open Main App
    private func openMainApp(route: String? = nil) {
        // Opens the main Atelic app - will show Login if not authenticated
        // or main app if already logged in
        // If route is provided, navigates to that specific screen
        let urlString = route != nil ? "atelicstable://\(route!)" : "atelicstable://"
        guard let url = URL(string: urlString) else { return }

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

// MARK: - UIGestureRecognizerDelegate
extension ShareViewController: UIGestureRecognizerDelegate {
    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldReceive touch: UITouch) -> Bool {
        // Only handle taps on the background (not on the container)
        return touch.view == view
    }
}
