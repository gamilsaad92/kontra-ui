const workflows = [];
function addWorkflow(workflow) {
  workflows.push(workflow);
  return workflow;
}
module.exports = { workflows, addWorkflow };
