import SwiftUI

extension Color {
    static let kontraBrand      = Color(red: 128/255, green: 0/255, blue: 32/255)
    static let kontraBrandLight = Color(red: 128/255, green: 0/255, blue: 32/255).opacity(0.12)
    static let kontraBrandMid   = Color(red: 160/255, green: 30/255, blue: 60/255)
}

extension ShapeStyle where Self == Color {
    static var kontraBrand: Color { .kontraBrand }
}
