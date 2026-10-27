# Editor-automation tools: triage list

These are one-off scripts used to drive Lens Studio (scene inspection, fixes, captures, LEAF setup) during development. They currently live in `spectacles-lens/scripts/`. Nothing has been moved or deleted yet.

**Human decision required:** choose which scripts to keep. A worker will then move the kept ones into `spectacles-lens/tools/` and delete the rest. Mark a script `KEEP` or `DELETE` below.

Descriptions are inferred from file names and the few in-file comments, so verify a script before deciding.

## Scripts (`spectacles-lens/scripts/`)

### Scene inspection and queries
| Script | Decision | What it does (inferred) |
|---|---|---|
| inspect_agent_detailed.js | | Dumps detailed component/property info for the agent object |
| inspect_assets.js | | Looks up asset(s) such as Mat_CritiqueCard and Mesh_ButtonBox |
| inspect_backplate_components.js | | Lists components on button backplates |
| inspect_btn_decision.js | | Inspects the decision button state |
| inspect_btn_details.js | | Inspects button details |
| inspect_button_children.js | | Lists child objects of buttons |
| inspect_button_setup.js | | Checks button component setup |
| inspect_full_audit_scene.js | | Full scene dump for audit |
| inspect_full_scene.js | | Full scene inspection |
| inspect_full_scene_dump.js | | Full scene dump to output |
| inspect_leaf_index_obj.js | | Inspects the LEAF index object |
| inspect_material.js | | Inspects a single material |
| inspect_materials.js | | Inspects materials across the scene |
| inspect_mesh.js | | Inspects mesh data |
| inspect_mutations.js | | Inspects recorded scene mutations |
| inspect_orb.js | | Inspects the orb object |
| inspect_orb_details.js | | Detailed orb inspection |
| inspect_positions.js | | Reads object positions |
| inspect_rmv.js | | Inspects RenderMeshVisual components |
| inspect_runtime_transforms.js | | Reads runtime transforms |
| inspect_scene.js | | General scene inspection |
| inspect_text_props.js | | Reads Text component properties |
| inspect_whiteboard.js | | Inspects the whiteboard object |
| inspect_whiteboard_materials.js | | Inspects whiteboard materials |
| inspect_world_visibility.js | | Checks world visibility of objects |
| list_scene_objects.js | | Lists scene objects |
| list_scene_tree.js | | Prints the scene hierarchy |
| query.json | | Saved query payload (data, not a script) |
| query_agent.js | | Queries the agent object |
| query_button.js | | Queries button objects |
| query_camera_params.js | | Reads camera parameters |
| query_controllers.js | | Queries controller objects |
| query_editor_scene.js | | Queries the editor scene |
| query_palette.js | | Queries the palette objects |
| query_palette_children.js | | Queries palette child objects |
| query_parent_transform.js | | Reads parent transforms |
| query_rotation_type.js | | Reads rotation type settings |
| query_runtime.js | | Queries runtime state |
| query_scene_layers.js | | Reads scene layer settings |
| query_transforms.js | | Reads object transforms |
| transform_introspect.js | | Introspects transform values |
| schema_introspect.js | | Introspects the Editor API schema |
| find_agent_script.js | | Finds the agent script asset |
| find_leaf_assets.js | | Finds LEAF-related assets |
| find_manipulation_asset.js | | Finds the manipulation asset |

### Scene fixes and setup (mutate the project)
| Script | Decision | What it does (inferred) |
|---|---|---|
| add_manipulation_component.js | | Adds a manipulation component to an object |
| add_whiteboard_interactable.js | | Adds an interactable to the whiteboard |
| adjust_layout.js | | Adjusts button layout and text |
| adjust_layout_view.js | | Adjusts layout view settings |
| apply_overlay_transform.js | | Applies a transform to the overlay |
| apply_room_layout.js | | Applies the room layout (moves toast/HUD objects) |
| attach_leaf_index.js | | Attaches the LEAF index to the scene |
| configure_buttons_exact.js | | Configures button components to exact values |
| configure_manipulation.js | | Configures manipulation settings |
| fix_all_btn_texts.js | | Fixes all button text |
| fix_button_visuals.js | | Fixes button visuals |
| fix_text_sizes.js | | Fixes text sizes |
| fix_whiteboard_collider.js | | Fixes whiteboard collider |
| generate_diagram_assets.js | | Generates diagram assets for the whiteboard |
| convert_svgs.js | | Converts SVG files |
| orient_whiteboard.js | | Orients the whiteboard |
| position_elements_properly.js | | Positions scene elements |
| refine_palette.js | | Refines palette sizing and aspect |
| repair_and_restore_scene.js | | Repairs and restores scene objects |
| restore_full_scene.js | | Restores the full scene from saved IDs |
| set_agent_parent.js | | Sets the parent of the agent object |
| set_initial_high_position.js | | Sets an initial high position for an object |
| set_leaf_script.js | | Assigns a LEAF script to an object |
| set_manip_props.js | | Sets manipulation properties |
| set_script_asset.js | | Assigns a script asset to a component |
| setup_pill_and_card.js | | Sets up pill and card objects |
| setup_whiteboard_parenting.js | | Sets up whiteboard parenting |
| wire_whiteboard_interactable.js | | Wires the whiteboard interactable |
| test_set_text_size.js | | Sets text size for a test |

### Testing, verification and runtime
| Script | Decision | What it does (inferred) |
|---|---|---|
| check_4buttons.js | | Checks the four buttons |
| check_btn_texts.js | | Checks button text values |
| check_preview_interact.js | | Checks preview interaction |
| check_toast.js | | Checks the toast object |
| check_toast_child.js | | Checks toast child objects |
| collect_runtime_logs.js | | Collects runtime logs |
| get_logs.js | | Reads logs |
| get_config.js | | Reads project config |
| list_mcp_tools.js | | Lists available MCP tools |
| mcp_call.js | | Generic MCP call helper |
| lib/mcpClient.js | | Shared MCP client helper (used by other scripts) |
| recompile_and_verify.js | | Recompiles and verifies the project |
| run_leaf_suite.js | | Runs the LEAF test suite |
| snap_panel.js | | Captures a panel snapshot |
| test_camera_anchor.js | | Tests camera anchoring |
| test_leaf_connection.js | | Tests the LEAF connection |
| test_mut.js | | Test for mutations |
| test_preview_interact.js | | Tests preview interaction |
| test_recompile_and_snap.js | | Recompiles and snaps a capture |
| test_rot.js | | Tests rotation |
| test_transition.js | | Tests transitions |
| test_wall_placement.js | | Tests wall placement |
| verify_workflow_states.js | | Verifies workflow states |
| walkthrough_demo_stages.js | | Walks through demo stages |

### Captures and demo recording
| Script | Decision | What it does (inferred) |
|---|---|---|
| capture_demo_states.js | | Captures demo states |
| capture_final.js | | Captures the final state |
| capture_full_demo_journey.js | | Captures the full demo journey |
| capture_preview.js | | Captures a preview frame |
| capture_state.js | | Captures a state |
| capture_state1.js | | Captures state 1 |
| inspect_capture_err.js | | Inspects capture errors |
| record_demo_journey.js | | Records the demo journey (cleans frames first) |
| generate_demo_video.py | | Builds a demo video from captured frames |

### One-off step scripts (PowerShell)
| Script | Decision | What it does (inferred) |
|---|---|---|
| reconstruct_step197.ps1 | | One-off reconstruction for step 197 |
| step177_full.ps1 | | One-off full step 177 run (enables baseTex on materials) |
| step183_full.ps1 | | One-off full step 183 run |
| step185_full.ps1 | | One-off full step 185 run |
| step187_full.ps1 | | One-off full step 187 run |
| step197_full.ps1 | | One-off full step 197 run |

## Notes
- Captured screenshots (`*.jpg`) in `spectacles-lens/scripts/` are now gitignored. They are not tracked and were not deleted from disk.
- `query.json` is data, not a script.
- Scripts marked for deletion must be checked for use by other scripts (e.g. `lib/mcpClient.js`) before removal.
