$token = "Bearer Gt0ObwXN9IV3ZQdjIcikYkRFixTh2tWCFSnItHtkC5iHp9qDqQ8pq0yvRA97OkVF"
$meshId = "bca4812a-983e-4e68-b0da-7fe482703084" # Mesh_ButtonBox
$matId = "d761a15c-0e9d-4869-b66f-3f3fb6d824e0"  # Mat_ButtonBackplate
$interactableId = "652e631a-22d0-4941-9f74-2943df59f34c"

$buttons = @(
    @{ id = "e21c9cbc-d4c3-426b-8f7d-6a1d78dfea45"; label = "◇ Decision"; y = 15; w = 15 },
    @{ id = "a90dd370-9ce1-4589-826b-64940b241145"; label = "▭ Service"; y = 9; w = 15 },
    @{ id = "c9bf271d-c938-41bc-945d-236c7987ca43"; label = "🛢 Database"; y = 3; w = 15 },
    @{ id = "3d0aea0d-655d-4729-8c2a-38eae528e068"; label = "○ Terminal"; y = -3; w = 15 },
    @{ id = "5372a530-7c8a-462c-be86-f776c9a79b3f"; label = "📸 Update / Snapshot"; y = -10; w = 18 },
    @{ id = "20e18c41-8ab6-49ce-8369-1e40ab736037"; label = "✓ Conclude Meeting"; y = -16; w = 18 }
)

foreach ($btn in $buttons) {
    $btnId = $btn.id
    $label = $btn.label
    $y = $btn.y
    $w = $btn.w

    $q = @"
mutation {
  rmv: addComponent(id: "$btnId", componentType: "RenderMeshVisual") { id }
  col: addComponent(id: "$btnId", componentType: "ColliderComponent") { id }
  sc: addComponent(id: "$btnId", componentType: "ScriptComponent") { id }
  txt: addComponent(id: "$btnId", componentType: "Text") { id }
  tf: setLocalTransform(
    id: "$btnId"
    position: { x: 0, y: $y, z: 0 }
    scale: { x: $w, y: 4.5, z: 1.5 }
  ) { success }
}
"@
    $body = @{
        jsonrpc = "2.0"
        id = 1
        method = "tools/call"
        params = @{ name = "scene-graphql"; arguments = @{ query = $q } }
    } | ConvertTo-Json -Depth 5

    $res = Invoke-RestMethod -Uri "http://localhost:50040/mcp" -Method Post -Headers @{ Authorization = $token } -Body $body -ContentType "application/json"
    $d = $res.result.content[0].text | ConvertFrom-Json
    $rmvId = $d.data.rmv.id
    $scId = $d.data.sc.id
    $txtId = $d.data.txt.id

    $q2 = @"
mutation {
  setMesh: setProperty(id: "$rmvId", propertyPath: "mesh", value: "$meshId", valueType: REFERENCE) { success }
  setMat: setProperty(id: "$rmvId", propertyPath: "mainMaterial", value: "$matId", valueType: REFERENCE) { success }
  setScript: setProperty(id: "$scId", propertyPath: "scriptAsset", value: "$interactableId", valueType: REFERENCE) { success }
  setText: setProperty(id: "$txtId", propertyPath: "text", value: "$label", valueType: STRING) { success }
  setSize: setProperty(id: "$txtId", propertyPath: "size", value: 20, valueType: NUMBER) { success }
}
"@
    $body2 = @{
        jsonrpc = "2.0"
        id = 2
        method = "tools/call"
        params = @{ name = "scene-graphql"; arguments = @{ query = $q2 } }
    } | ConvertTo-Json -Depth 5

    $res2 = Invoke-RestMethod -Uri "http://localhost:50040/mcp" -Method Post -Headers @{ Authorization = $token } -Body $body2 -ContentType "application/json"
    Write-Output "Configured button $label"
}
