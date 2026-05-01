param(
    [string]$ServerName = "alphaxiv",
    [string]$Url = "https://api.alphaxiv.org/mcp/v1"
)

$config = @{
    mcpServers = @{
        $ServerName = @{
            command = "npx"
            args = @(
                "-y",
                "mcp-remote",
                $Url,
                "--header",
                "Authorization:`${ALPHAXIV_AUTH_HEADER}"
            )
        }
    }
}

$config | ConvertTo-Json -Depth 8
