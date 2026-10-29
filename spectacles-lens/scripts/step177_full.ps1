if (-not $env:LS_MCP_TOKEN) { throw 'LS_MCP_TOKEN environment variable is not set' }
$token = "Bearer $env:LS_MCP_TOKEN"

# 1. Enable baseTex define on Mat_Whiteboard and Mat_DiagramOverlay
$q1 = @'
mutation {
  p1: setProperty(
    id: "7fd6b2df-8198-43f5-9d90-03f0f34b6578"
    propertyPath: "passInfos.0.ENABLE_BASE_TEX"
    value: true
    valueType: BOOLEAN
  ) { success message }

  p2: setProperty(
    id: "3903e607-a6ab-4834-8994-c68878836d0e"
    propertyPath: "passInfos.0.ENABLE_BASE_TEX"
    value: true
    valueType: BOOLEAN
  ) { success message }
}
'@

$body1 = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "asset-graphql"
        arguments = @{ query = $q1 }
    }
} | ConvertTo-Json -Depth 5

$res1 = Invoke-RestMethod -Uri "http://localhost:50040/mcp" -Method Post -Headers @{ Authorization = $token } -Body $body1 -ContentType "application/json"
Write-Output "ENABLE_BASE_TEX: $($res1.result.content[0].text)"

# 2. Set textures and blend mode
$q2 = @'
mutation {
  texWhiteboard: setProperty(
    id: "7fd6b2df-8198-43f5-9d90-03f0f34b6578"
    propertyPath: "passInfos.0.baseTex"
    value: "6c0b8b91-d00f-43cf-8d9f-5a0f4eda2ac2"
    valueType: REFERENCE
  ) { success message }

  texOverlay: setProperty(
    id: "3903e607-a6ab-4834-8994-c68878836d0e"
    propertyPath: "passInfos.0.baseTex"
    value: "9c683a9f-bfaa-444d-8dd7-7d8b95f9bb68"
    valueType: REFERENCE
  ) { success message }

  blendOverlay: setProperty(
    id: "3903e607-a6ab-4834-8994-c68878836d0e"
    propertyPath: "passInfos.0.blendMode"
    value: "Normal"
    valueType: ENUM
    enumType: "Editor.Assets.BlendMode"
  ) { success message }
}
'@

$body2 = @{
    jsonrpc = "2.0"
    id = 2
    method = "tools/call"
    params = @{
        name = "asset-graphql"
        arguments = @{ query = $q2 }
    }
} | ConvertTo-Json -Depth 5

$res2 = Invoke-RestMethod -Uri "http://localhost:50040/mcp" -Method Post -Headers @{ Authorization = $token } -Body $body2 -ContentType "application/json"
Write-Output "Textures and Blend: $($res2.result.content[0].text)"
