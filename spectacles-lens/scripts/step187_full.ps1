if (-not $env:LS_MCP_TOKEN) { throw 'LS_MCP_TOKEN environment variable is not set' }
$token = "Bearer $env:LS_MCP_TOKEN"
$query = @'
mutation {
  setMesh: setProperty(
    id: "fa550d83-56cb-42ab-a302-cdb266f8b7e7"
    propertyPath: "mesh"
    value: "1d1de908-3f6f-4db5-9307-716d2834bd0c"
    valueType: REFERENCE
  ) { success message }

  setMat: setProperty(
    id: "fa550d83-56cb-42ab-a302-cdb266f8b7e7"
    propertyPath: "mainMaterial"
    value: "7fd6b2df-8198-43f5-9d90-03f0f34b6578"
    valueType: REFERENCE
  ) { success message }
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
