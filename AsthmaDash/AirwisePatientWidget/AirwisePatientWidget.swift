import SwiftUI
import WidgetKit

private struct CheckInEntry: TimelineEntry {
    let date: Date
}

private struct CheckInProvider: TimelineProvider {
    func placeholder(in context: Context) -> CheckInEntry { CheckInEntry(date: .now) }
    func getSnapshot(in context: Context, completion: @escaping (CheckInEntry) -> Void) {
        completion(CheckInEntry(date: .now))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<CheckInEntry>) -> Void) {
        let entry = CheckInEntry(date: .now)
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(60 * 60))))
    }
}

private struct WidgetBuddyFace: View {
    let score: Int
    let color: Color
    var size: CGFloat = 26
    private let ink = Color(hex: 0x24464A)

    var body: some View {
        ZStack {
            Circle().fill(LinearGradient(colors: [color.opacity(0.78), color], startPoint: .topLeading, endPoint: .bottomTrailing))
            Circle().stroke(.white.opacity(0.8), lineWidth: max(1, size * 0.04))
            if score >= 4 {
                Circle().fill(Color(hex: 0xE96D82).opacity(0.45)).frame(width: size * 0.12, height: size * 0.07).offset(x: -size * 0.24, y: size * 0.1)
                Circle().fill(Color(hex: 0xE96D82).opacity(0.45)).frame(width: size * 0.12, height: size * 0.07).offset(x: size * 0.24, y: size * 0.1)
            }
            Ellipse().fill(ink).frame(width: size * 0.1, height: size * 0.16).offset(x: -size * 0.17, y: -size * 0.12)
            Ellipse().fill(ink).frame(width: size * 0.1, height: size * 0.16).offset(x: size * 0.17, y: -size * 0.12)
            WidgetBuddyMouth(score: score).stroke(ink, style: StrokeStyle(lineWidth: max(1, size * 0.055), lineCap: .round))
                .frame(width: size * 0.48, height: size * 0.23).offset(y: size * 0.16)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }
}

private struct WidgetBuddyMouth: Shape {
    let score: Int
    func path(in rect: CGRect) -> Path {
        var path = Path()
        if score == 3 {
            path.move(to: CGPoint(x: rect.minX, y: rect.midY))
            path.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
        } else if score < 3 {
            path.move(to: CGPoint(x: rect.minX, y: rect.maxY * 0.7))
            path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.maxY * 0.7), control: CGPoint(x: rect.midX, y: rect.minY))
        } else {
            path.move(to: CGPoint(x: rect.minX, y: rect.minY + rect.height * 0.18))
            path.addQuadCurve(to: CGPoint(x: rect.maxX, y: rect.minY + rect.height * 0.18), control: CGPoint(x: rect.midX, y: rect.maxY))
        }
        return path
    }
}

private struct CheckInWidgetView: View {
    private let moods: [(Int, Color)] = [
        (1, Color(hex: 0xEB5757)),
        (2, Color(hex: 0xF2994A)),
        (3, Color(hex: 0xF2C94C)),
        (4, Color(hex: 0x80CF45)),
        (5, Color(hex: 0x2FBF71))
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 6) {
                Image(systemName: "wind").foregroundStyle(Color(hex: 0x078B8C))
                Text("Quick check-in").font(.headline)
                Spacer()
                Text("Tap answers · finish in app").font(.caption2).foregroundStyle(.secondary)
            }

            HStack(spacing: 0) {
                ForEach(moods, id: \.0) { score, color in
                    Link(destination: URL(string: "airwise://check-in?feeling=\(score)")!) {
                        VStack(spacing: 3) {
                            WidgetBuddyFace(score: score, color: color, size: 28)
                            Text(["Bad", "Not great", "Okay", "Good", "Great"][score - 1])
                                .font(.system(size: 9, weight: .medium)).foregroundStyle(.secondary).lineLimit(1).minimumScaleFactor(0.75)
                        }
                        .frame(maxWidth: .infinity, minHeight: 42)
                        .contentShape(Rectangle())
                    }
                }
            }

            HStack(spacing: 7) {
                quickLink("Cough", icon: "lungs", color: Color(hex: 0x36A9DB), url: "airwise://check-in?symptom=Coughing")
                quickLink("Wheeze", icon: "wind", color: Color(hex: 0x078B8C), url: "airwise://check-in?symptom=Wheezing")
                quickLink("Tight chest", icon: "lungs.fill", color: Color(hex: 0xA64A9C), url: "airwise://check-in?symptom=Tight%20chest")
                quickLink("Inhaler needed", icon: "cross.case.fill", color: Color(hex: 0xE56C9A), url: "airwise://check-in?inhalerNeeded=true")
            }
        }
        .padding(.horizontal, 4)
        .widgetURL(URL(string: "airwise://check-in"))
        .containerBackground(.background, for: .widget)
    }

    private func quickLink(_ title: String, icon: String, color: Color, url: String) -> some View {
        Link(destination: URL(string: url)!) {
            Label(title, systemImage: icon)
                .font(.system(size: 9, weight: .semibold))
                .lineLimit(1).minimumScaleFactor(0.7)
                .foregroundStyle(color)
                .frame(maxWidth: .infinity, minHeight: 28)
                .padding(.horizontal, 4)
                .background(color.opacity(0.09), in: Capsule())
        }
    }
}

struct AirwisePatientWidget: Widget {
    let kind = "AirwisePatientWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: CheckInProvider()) { _ in
            CheckInWidgetView()
        }
        .configurationDisplayName("Asthma check-in")
        .description("Choose a feeling or symptom, then finish your check-in in Airwise Patient.")
        .supportedFamilies([.systemMedium])
    }
}

private extension Color {
    init(hex: UInt) {
        self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255,
                  green: Double((hex >> 8) & 0xFF) / 255,
                  blue: Double(hex & 0xFF) / 255, opacity: 1)
    }
}

#Preview(as: .systemMedium) {
    AirwisePatientWidget()
} timeline: {
    CheckInEntry(date: .now)
}
