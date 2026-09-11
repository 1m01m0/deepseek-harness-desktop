import Foundation

// The launch token may span pipe chunks. Only parse newline-terminated
// readiness lines, and keep the query for the token-to-cookie exchange.
func parseServerURL(from text: String) -> URL? {
    for line in text.components(separatedBy: "\n").dropLast() {
        guard line.hasPrefix("dsh web: ") else { continue }
        let address = line.dropFirst("dsh web: ".count).split(whereSeparator: { $0.isWhitespace }).first
        guard let address, let url = URL(string: String(address)),
              url.scheme == "http", url.host == "127.0.0.1",
              url.port != nil, url.user == nil, url.password == nil else { continue }
        return url
    }
    return nil
}
