import Foundation

@main
struct ServerURLTests {
    static func main() {
        let full = "dsh web: http://127.0.0.1:12345/?token=test-token\n"
        assert(parseServerURL(from: full)?.query == "token=test-token")
        assert(parseServerURL(from: "dsh web: http://127.0.0.1:12345\n")?.port == 12345)
        assert(parseServerURL(from: "dsh web: http://127.0.0.1:12345/?token=part") == nil)
        assert(parseServerURL(from: "noise http://127.0.0.1:12345\n") == nil)
        assert(parseServerURL(from: "dsh web: http://127.0.0.1.example.com:12345/\n") == nil)
        assert(parseServerURL(from: "dsh web: http://127.0.0.1:12345@evil.example/\n") == nil)
        assert(parseServerURL(from: full.trimmingCharacters(in: .newlines) + " (LAN: http://192.168.1.2:12345/?token=lan)\n")?.host == "127.0.0.1")
        print("PASS: Swift readiness parser preserves complete loopback authentication URLs")
    }
}
