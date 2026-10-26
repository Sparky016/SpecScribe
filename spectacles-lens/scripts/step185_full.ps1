if (-not $env:LS_MCP_TOKEN) { throw 'LS_MCP_TOKEN environment variable is not set' }
$token = "Bearer $env:LS_MCP_TOKEN"
$query = @'
mutation {
  addComp: addComponent(
    id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
    componentType: "RenderMeshVisual"
  ) {
    id
    type
  }

  setTf: setLocalTransform(
    id: "202cf816-8f02-4710-bbbe-ac742c5cdc0c"
    position: { x: 0, y: 0, z: -116 }
    scale: { x: 120, y: 80, z: 1 }
  ) {
    success
  }
}
'@

$body = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{
        name = "scene-graphql"
        arguments = @{ query = $query }
    }
} | ConvertTo-Json -Depth 5

$res = Invoke-RestMethod -Uri "http://localhost:50040/mcp" -Method Post -Headers @{ Authorization = $token } -Body $body -ContentType "application/json"
$res.result.content[0].text
