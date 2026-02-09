import WidgetKit
import SwiftUI

private let appGroupId = "group.app.planmoni.widget"
private let nextPayoutKey = "nextPayout"

struct NextPayoutEntry: TimelineEntry {
    let date: Date
    let planId: String?
    let planName: String
    let payoutDate: Date?
    let amount: Double
    let countdownText: String
    let isEmpty: Bool
}

struct PlanmoniWidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextPayoutEntry {
        NextPayoutEntry(
            date: Date(),
            planId: nil,
            planName: "",
            payoutDate: nil,
            amount: 0,
            countdownText: "Open Planmoni to see your next payout",
            isEmpty: true
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (NextPayoutEntry) -> Void) {
        let entry = makeEntry(for: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextPayoutEntry>) -> Void) {
        let now = Date()
        var entries: [NextPayoutEntry] = []

        let defaults = UserDefaults(suiteName: appGroupId)
        let jsonString = defaults?.string(forKey: nextPayoutKey)

        guard let data = jsonString?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let planName = json["planName"] as? String,
              let dateString = json["nextPayoutDate"] as? String,
              let payoutDate = iso8601Date(from: dateString),
              payoutDate > now else {
            entries.append(NextPayoutEntry(
                date: now,
                planId: nil,
                planName: "",
                payoutDate: nil,
                amount: 0,
                countdownText: "No upcoming payout",
                isEmpty: true
            ))
            let timeline = Timeline(entries: entries, policy: .after(Calendar.current.date(byAdding: .hour, value: 1, to: now)!))
            completion(timeline)
            return
        }

        let planId = json["planId"] as? String
        let amount = (json["payoutAmount"] as? NSNumber).map { $0.doubleValue } ?? 0

        // Generate one entry per minute until payout (cap at 7 days to limit entries)
        let minuteInterval: TimeInterval = 60
        let maxEntries = 60 * 24 * 7 // 7 days of minutes
        var entryDate = now
        var count = 0
        while entryDate < payoutDate && count < maxEntries {
            let countdownText = countdownText(from: entryDate, to: payoutDate)
            entries.append(NextPayoutEntry(
                date: entryDate,
                planId: planId,
                planName: planName,
                payoutDate: payoutDate,
                amount: amount,
                countdownText: countdownText,
                isEmpty: false
            ))
            entryDate = Calendar.current.date(byAdding: .minute, value: 1, to: entryDate) ?? entryDate.addingTimeInterval(minuteInterval)
            count += 1
        }

        // After payout, show "Payout Sent" and refresh in 1 hour
        let afterPayout = Calendar.current.date(byAdding: .minute, value: 1, to: payoutDate) ?? payoutDate.addingTimeInterval(60)
        entries.append(NextPayoutEntry(
            date: afterPayout,
            planId: planId,
            planName: planName,
            payoutDate: payoutDate,
            amount: amount,
            countdownText: "Payout Sent",
            isEmpty: false
        ))

        let reloadDate = entries.isEmpty ? Calendar.current.date(byAdding: .hour, value: 1, to: now)! : Calendar.current.date(byAdding: .hour, value: 1, to: afterPayout)!
        let timeline = Timeline(entries: entries, policy: .after(reloadDate))
        completion(timeline)
    }

    private func makeEntry(for date: Date) -> NextPayoutEntry {
        let defaults = UserDefaults(suiteName: appGroupId)
        let jsonString = defaults?.string(forKey: nextPayoutKey)

        guard let data = jsonString?.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let planName = json["planName"] as? String,
              let dateString = json["nextPayoutDate"] as? String,
              let payoutDate = iso8601Date(from: dateString) else {
            return NextPayoutEntry(
                date: date,
                planId: nil,
                planName: "",
                payoutDate: nil,
                amount: 0,
                countdownText: "No upcoming payout",
                isEmpty: true
            )
        }

        let planId = json["planId"] as? String
        let amount = (json["payoutAmount"] as? NSNumber).map { $0.doubleValue } ?? 0
        let countdownText = countdownText(from: date, to: payoutDate)

        return NextPayoutEntry(
            date: date,
            planId: planId,
            planName: planName,
            payoutDate: payoutDate,
            amount: amount,
            countdownText: countdownText,
            isEmpty: false
        )
    }

    private func iso8601Date(from string: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: string) { return date }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: string)
    }

    private func countdownText(from fromDate: Date, to toDate: Date) -> String {
        let interval = toDate.timeIntervalSince(fromDate)
        guard interval > 0 else { return "Payout Sent" }
        let totalSeconds = Int(interval)
        let days = totalSeconds / (60 * 60 * 24)
        let hours = (totalSeconds % (60 * 60 * 24)) / (60 * 60)
        let minutes = (totalSeconds % (60 * 60)) / 60

        var parts: [String] = []
        if days > 0 { parts.append("\(days) day\(days == 1 ? "" : "s")") }
        if hours > 0 { parts.append("\(hours) hour\(hours == 1 ? "" : "s")") }
        if minutes > 0 { parts.append("\(minutes) min\(minutes == 1 ? "" : "s")") }
        if days == 0 && hours == 0 && minutes == 0 { return "less than a minute left" }
        return (parts.isEmpty ? "less than a minute" : parts.joined(separator: ", ")) + " left"
    }
}

struct PlanmoniWidgetEntryView: View {
    var entry: PlanmoniWidgetProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        let url: URL? = entry.planId.flatMap { URL(string: "myapp://view-payout?id=\($0)") }
        return Group {
            if family == .systemMedium {
                mediumView
            } else {
                smallView
            }
        }
        .widgetURL(url)
    }

    private var smallView: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Up Next")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
            if entry.isEmpty {
                Text(entry.countdownText)
                    .font(.subheadline)
                    .fontWeight(.500)
                    .foregroundColor(.primary)
                    .lineLimit(2)
            } else {
                Text(entry.planName)
                    .font(.subheadline)
                    .fontWeight(.600)
                    .foregroundColor(.primary)
                    .lineLimit(1)
                Text(formatAmount(entry.amount))
                    .font(.subheadline)
                    .fontWeight(.500)
                    .foregroundColor(.blue)
                Text(entry.countdownText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .padding()
    }

    private var mediumView: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Up Next")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
                if !entry.isEmpty {
                    Text(entry.planName)
                        .font(.headline)
                        .fontWeight(.600)
                        .foregroundColor(.primary)
                    Text(formatAmount(entry.amount))
                        .font(.title3)
                        .fontWeight(.500)
                        .foregroundColor(.blue)
                }
            }
            Spacer()
            if !entry.isEmpty {
                Text(entry.countdownText)
                    .font(.subheadline)
                    .fontWeight(.500)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.trailing)
            } else {
                Text(entry.countdownText)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.trailing)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func formatAmount(_ amount: Double) -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        let formatted = formatter.string(from: NSNumber(value: amount)) ?? "0.00"
        return "₦\(formatted)"
    }
}

@main
struct PlanmoniWidget: Widget {
    let kind: String = "PlanmoniWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: PlanmoniWidgetProvider()) { entry in
            PlanmoniWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Up Next")
        .description("See your next payout plan and countdown.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
