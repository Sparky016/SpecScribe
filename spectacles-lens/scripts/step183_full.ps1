$token = "Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF"
$query = @'
mutation {
  createObj: createSceneObject(
    name: "WhiteboardBackplate"
    parentId: "7e394714-7a6a-4e46-875f-5b92a6021979"
  ) {
    id
    name
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
$objId = $res.result.content[0].text
Write-Output "Created: $objId"
